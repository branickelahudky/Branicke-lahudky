/**
 * Idempotentní re-import produktů ze Shoptet XML.
 * - UPSERT (update pokud SKU existuje, create pokud ne)
 * - Auto-vytváří chybějící kategorie
 * - JEDEN PRODUKT NESMÍ ZASTAVIT IMPORT (try/catch per produkt)
 * - Nahrává fotky do Cloudflare R2 přes processAndUpload
 * Použití: npx tsx scripts/reimport-shoptet.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { processAndUpload } from '../src/lib/image-upload'

const prisma = new PrismaClient()
const XML_FILE = resolve(__dirname, '../data/shoptet-export.xml')

// ── Helpers ──────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toArr<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

function stripCdata(v: unknown): string {
  if (!v) return ''
  return String(v).replace(/<!\[CDATA\[|\]\]>/g, '').trim()
}

async function fetchWithTimeout(url: string, timeoutMs = 30_000): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    return buf
  } finally {
    clearTimeout(timer)
  }
}

// ── XML typy ─────────────────────────────────────────────────────

interface XmlVariant {
  '@_id': string
  UNIT?: string
  CODE?: string
  LOGISTIC?: { WEIGHT?: number | string }
  VAT?: number | string
  PRICE_VAT?: number | string
  STOCK?: { AMOUNT?: number | string }
  VISIBLE?: number | string
  PARAMETERS?: {
    PARAMETER?: { NAME: string; VALUE: string } | { NAME: string; VALUE: string }[]
  }
}

interface XmlFlag { CODE: string; ACTIVE: number | string }
interface XmlImage { '#text': string; '@_description'?: string }
interface XmlCategory { '#text': string; '@_id': string }

interface XmlShopItem {
  '@_id': string
  NAME: string
  SHORT_DESCRIPTION?: string
  DESCRIPTION?: string
  CATEGORIES?: {
    CATEGORY?: XmlCategory | XmlCategory[]
    DEFAULT_CATEGORY?: XmlCategory | XmlCategory[]
  }
  IMAGES?: { IMAGE?: XmlImage | XmlImage[] | string }
  FLAGS?: { FLAG?: XmlFlag | XmlFlag[] }
  VAT?: number | string
  PRICE_VAT?: number | string
  STOCK?: { AMOUNT?: number | string }
  VISIBLE?: number | string
  VARIANTS?: { VARIANT?: XmlVariant | XmlVariant[] }
}

// ── XML Parsing ───────────────────────────────────────────────────

function parseXml(): XmlShopItem[] {
  if (!existsSync(XML_FILE)) {
    console.error(`❌ Soubor nenalezen: ${XML_FILE}`)
    process.exit(1)
  }
  const xml = readFileSync(XML_FILE, 'utf-8')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
    cdataPropName: '__cdata',
    isArray: (name) =>
      ['SHOPITEM', 'VARIANT', 'CATEGORY', 'DEFAULT_CATEGORY', 'FLAG', 'IMAGE', 'PARAMETER'].includes(name),
    allowBooleanAttributes: true,
  })
  const result = parser.parse(xml)
  return result?.SHOP?.SHOPITEM ?? []
}

// ── Variant helpers ───────────────────────────────────────────────

function parseWeightKg(value: string): number | null {
  const s = value.trim().replace(',', '.')
  const kg = s.match(/^([\d.]+)\s*kg$/i)
  if (kg) return parseFloat(kg[1])
  const g = s.match(/^([\d.]+)\s*g$/i)
  if (g) return parseFloat(g[1]) / 1000
  return null
}

function formatWeight(kg: number): string {
  if (kg >= 1) return `${kg} kg`
  return `${Math.round(kg * 1000)} g`
}

// ── Kategorie cache ───────────────────────────────────────────────

// Map slug → DB id, předem načteno z DB + auto-create při potřebě
const catSlugToId = new Map<string, string>()

async function initCategoryCache() {
  const allCats = await prisma.category.findMany({ select: { id: true, slug: true } })
  for (const c of allCats) catSlugToId.set(c.slug, c.id)
}

async function ensureCategory(catText: string): Promise<string | null> {
  if (!catText.trim()) return null

  const parts = catText.split('>').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  let parentId: string | null = null
  let finalId: string | null = null

  for (let i = 0; i < parts.length; i++) {
    // slug je akumulovaný přes celou cestu (konzistentní s existing extractCategories)
    const slug = parts.slice(0, i + 1).map(slugify).join('-')
    const name = parts[i]

    if (catSlugToId.has(slug)) {
      parentId = catSlugToId.get(slug)!
      finalId = parentId
      continue
    }

    // Kategorie neexistuje → vytvoř
    let trySlug = slug
    // Ošetři edge case duplicitního slugu s jiným názvem
    const existingBySlug = await prisma.category.findUnique({ where: { slug: trySlug }, select: { id: true } })
    if (existingBySlug) {
      catSlugToId.set(trySlug, existingBySlug.id)
      parentId = existingBySlug.id
      finalId = existingBySlug.id
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newCatRow: any = await prisma.category.create({
      data: { name, slug: trySlug, parentId, isActive: true, sortOrder: 0 },
      select: { id: true },
    })
    const newCatId: string = newCatRow.id
    catSlugToId.set(trySlug, newCatId)
    parentId = newCatId
    finalId = newCatId
  }

  return finalId
}

// ── Fotky ─────────────────────────────────────────────────────────

async function importImages(productId: string, images: (XmlImage | string)[]): Promise<{
  uploaded: number
  failed: number
}> {
  let uploaded = 0
  let failed = 0

  // Idempotentní: pokud produkt už má fotky, přeskočíme
  const existingCount = await prisma.productImage.count({ where: { productId } })
  if (existingCount > 0) {
    return { uploaded: 0, failed: 0 } // skip - already imported
  }

  let sortOrder = 0
  for (const img of images) {
    const url = typeof img === 'string' ? img : img['#text'] ?? ''
    const altText = typeof img === 'object' ? (img['@_description'] ?? null) : null
    if (!url) continue

    try {
      const buffer = await fetchWithTimeout(url)
      const result = await processAndUpload(buffer, productId)

      await prisma.productImage.create({
        data: {
          productId,
          url: result.url,
          thumbnailUrl: result.thumbnailUrl,
          storageKey: result.storageKey,
          thumbnailKey: result.thumbnailKey,
          altText: altText ? String(altText) : null,
          sortOrder,
          isPrimary: sortOrder === 0,
          width: result.width,
          height: result.height,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
        },
      })
      uploaded++
      sortOrder++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`    ⚠️  fotka selhala (${msg.slice(0, 60)})\n`)
      failed++
    }
  }

  return { uploaded, failed }
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('📖 Čtu XML…')
  const items = parseXml()
  console.log(`✅ Načteno ${items.length} produktů z XML\n`)

  console.log('📂 Načítám kategorii cache…')
  await initCategoryCache()
  console.log(`   ${catSlugToId.size} kategorií v DB\n`)

  let created = 0
  let updated = 0
  let errors = 0
  const errorDetails: string[] = []

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    const shoptetId = String(item['@_id'])
    const name = String(item.NAME ?? '').trim()
    const pos = `[${idx + 1}/${items.length}]`

    if (!name) {
      process.stdout.write(`${pos} ⚠ id=${shoptetId} – bez názvu, přeskočen\n`)
      errors++
      errorDetails.push(`id=${shoptetId}: chybí název`)
      continue
    }

    try {
      // ── Ceny ──
      const variants = toArr(item.VARIANTS?.VARIANT)
      const firstVariant = variants[0]
      const vatRate = parseFloat(String(firstVariant?.VAT ?? item.VAT ?? 12)) || 12
      const priceWithVat = parseFloat(String(firstVariant?.PRICE_VAT ?? item.PRICE_VAT ?? 0)) || 0
      const priceWithoutVat = vatRate > 0
        ? Math.round((priceWithVat / (1 + vatRate / 100)) * 100) / 100
        : priceWithVat

      // ── Jednotka ──
      const unitRaw = (firstVariant?.UNIT ?? 'kg').toLowerCase()
      const unit: 'KS' | 'KG' = unitRaw === 'ks' ? 'KS' : 'KG'
      const isWeightBased = unit !== 'KS'

      // ── Sklad ──
      const stockQuantity = parseInt(String(firstVariant?.STOCK?.AMOUNT ?? item.STOCK?.AMOUNT ?? 0)) || 0
      const stockStatus = stockQuantity > 5 ? 'IN_STOCK' : stockQuantity > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK'
      const visible = String(item.VISIBLE ?? '1') !== '0'

      // ── Příznaky ──
      const flags = toArr(item.FLAGS?.FLAG)
      const isNew = flags.some((f) => String(f.CODE) === 'new' && String(f.ACTIVE) === '1')
      const isFeatured = flags.some((f) => String(f.CODE) === 'tip' && String(f.ACTIVE) === '1')
      const isOnSale = flags.some((f) => String(f.CODE) === 'action' && String(f.ACTIVE) === '1')

      // ── Popis ──
      const shortDescription = stripCdata(item.SHORT_DESCRIPTION) || null
      const description = stripCdata(item.DESCRIPTION) || null

      // ── Kategorie ──
      const defaultCats = toArr(item.CATEGORIES?.DEFAULT_CATEGORY)
      const allCats = toArr(item.CATEGORIES?.CATEGORY)
      const catEntry = defaultCats[0] ?? allCats[0]
      const catText = catEntry ? (typeof catEntry === 'string' ? catEntry : catEntry['#text'] ?? '') : ''

      let categoryId = await ensureCategory(catText)
      let catWarning = false

      if (!categoryId) {
        // Fallback: použij první kategorii v DB
        const firstCat = await prisma.category.findFirst({ select: { id: true } })
        if (!firstCat) throw new Error('Žádná kategorie v DB, nelze přiřadit')
        categoryId = firstCat.id
        catWarning = true
      }

      // ── UPSERT produkt ──
      const existingProduct = await prisma.product.findUnique({
        where: { sku: shoptetId },
        select: { id: true },
      })

      let productId: string
      let wasCreated: boolean

      if (existingProduct) {
        // UPDATE
        await prisma.product.update({
          where: { sku: shoptetId },
          data: {
            name,
            shortDescription,
            description,
            priceWithVat,
            priceWithoutVat,
            vatRate,
            unit,
            isWeightBased,
            stockQuantity,
            stockStatus: stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
            trackStock: true,
            categoryId,
            isNew,
            isFeatured,
            isOnSale,
            isActive: visible,
          },
        })
        productId = existingProduct.id
        wasCreated = false
      } else {
        // CREATE - slug musí být unikátní
        let slug = slugify(name)
        const slugExists = await prisma.product.findUnique({ where: { slug }, select: { id: true } })
        if (slugExists) slug = `${slug}-${shoptetId}`

        const newProduct = await prisma.product.create({
          data: {
            sku: shoptetId,
            slug,
            name,
            shortDescription,
            description,
            priceWithVat,
            priceWithoutVat,
            vatRate,
            unit,
            isWeightBased,
            stockQuantity,
            stockStatus: stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
            trackStock: true,
            categoryId,
            isNew,
            isFeatured,
            isOnSale,
            isActive: visible,
            publishedAt: visible ? new Date() : null,
          },
        })
        productId = newProduct.id
        wasCreated = true
      }

      // ── Varianty (jen při vytvoření, aby nedošlo k duplikátům) ──
      if (wasCreated && variants.length > 1) {
        let sortOrder = 0
        for (const v of variants) {
          const variantSku = String(v.CODE ?? '').trim()
          if (!variantSku) continue
          const params = toArr(v.PARAMETERS?.PARAMETER)
          const weightParam = params.find((p) => String(p.NAME).trim() === 'Váha')
          const weightKg = weightParam ? parseWeightKg(String(weightParam.VALUE)) : null
          const variantName = weightKg !== null ? formatWeight(weightKg) : variantSku
          const vPriceVat = parseFloat(String(v.PRICE_VAT ?? 0)) || 0
          const vVatRate = parseFloat(String(v.VAT ?? vatRate)) || vatRate
          const vPriceNoVat = vVatRate > 0
            ? Math.round((vPriceVat / (1 + vVatRate / 100)) * 100) / 100
            : vPriceVat
          const vStock = parseInt(String(v.STOCK?.AMOUNT ?? 0)) || 0

          // Skip variant SKU conflicts
          const variantExists = await prisma.productVariant.findUnique({ where: { sku: variantSku }, select: { id: true } })
          if (variantExists) continue

          await prisma.productVariant.create({
            data: {
              productId,
              sku: variantSku,
              name: variantName,
              weightKg: weightKg ?? null,
              priceWithVat: vPriceVat,
              priceWithoutVat: vPriceNoVat,
              stockQuantity: vStock,
              sortOrder,
            },
          })
          sortOrder++
        }
      }

      // ── Fotky ──
      const imageList = toArr(item.IMAGES?.IMAGE)
      const imgResult = imageList.length > 0
        ? await importImages(productId, imageList)
        : { uploaded: 0, failed: 0 }

      // ── Výstup ──
      const icon = catWarning ? '⚠' : wasCreated ? '✓' : '↻'
      const action = catWarning
        ? `${wasCreated ? 'vytvořeno' : 'aktualizováno'}, ⚠ fallback kategorie`
        : wasCreated ? 'vytvořeno' : 'aktualizováno'
      const imgLine = imgResult.uploaded > 0
        ? ` 📷 ${imgResult.uploaded} fotka`
        : imgResult.failed > 0
          ? ` ⚠️ fotka selhala`
          : ' (fotky: přeskočeno)'

      process.stdout.write(`${pos} ${icon} ${name} (${shoptetId}) - ${action}${imgLine}\n`)

      if (wasCreated) created++
      else updated++

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`${pos} ✗ ${name} (${shoptetId}) - chyba: ${msg.slice(0, 100)}\n`)
      errors++
      errorDetails.push(`${shoptetId} ${name}: ${msg.slice(0, 120)}`)
    }
  }

  // ── Souhrn ──
  console.log('\n' + '═'.repeat(60))
  console.log('✅ Re-import dokončen!')
  console.log(`   Vytvořeno    : ${created}`)
  console.log(`   Aktualizováno: ${updated}`)
  console.log(`   Chyb         : ${errors}`)
  if (errorDetails.length > 0) {
    console.log('\nChyby:')
    errorDetails.forEach((d) => console.log(`  ✗ ${d}`))
  }

  // Finální počty
  const [pCount, iCount, cCount] = await Promise.all([
    prisma.product.count(),
    prisma.productImage.count(),
    prisma.category.count(),
  ])
  console.log(`\n📊 DB po importu:`)
  console.log(`   Produkty  : ${pCount}`)
  console.log(`   Fotky     : ${iCount}`)
  console.log(`   Kategorie : ${cCount}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
