/**
 * Import produktů ze Shoptet XML exportu do Prisma DB.
 * Použití: npm run db:import-shoptet
 */

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import * as readline from 'readline'
import { PrismaClient } from '@prisma/client'

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

/** Parse variant weight from "Váha" parameter value like "1kg", "250 g", "0,5kg" → kg as number */
function parseWeightKg(value: string): number | null {
  const s = value.trim().replace(',', '.')
  const kgMatch = s.match(/^([\d.]+)\s*kg$/i)
  if (kgMatch) return parseFloat(kgMatch[1])
  const gMatch = s.match(/^([\d.]+)\s*g$/i)
  if (gMatch) return parseFloat(gMatch[1]) / 1000
  const mlMatch = s.match(/^([\d.]+)\s*ml$/i)
  if (mlMatch) return parseFloat(mlMatch[1]) / 1000
  const lMatch = s.match(/^([\d.]+)\s*l$/i)
  if (lMatch) return parseFloat(lMatch[1])
  return null
}

/** Format weight for variant name: 0.25 → "250 g", 1 → "1 kg", 0.5 → "500 g" */
function formatWeight(kg: number): string {
  if (kg >= 1 && Number.isInteger(kg)) return `${kg} kg`
  if (kg >= 1) return `${kg} kg`
  return `${Math.round(kg * 1000)} g`
}

function toArr<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── XML Parsing ───────────────────────────────────────────────────

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

interface XmlFlag {
  CODE: string
  ACTIVE: number | string
}

interface XmlImage {
  '#text': string
  '@_description'?: string
}

interface XmlCategory {
  '#text': string
  '@_id': string
}

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

function parseXml(): XmlShopItem[] {
  if (!existsSync(XML_FILE)) {
    console.error(`❌ Soubor nenalezen: ${XML_FILE}`)
    process.exit(1)
  }

  console.log(`📖 Čtu XML: ${XML_FILE}`)
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
  const items: XmlShopItem[] = result?.SHOP?.SHOPITEM ?? []
  console.log(`✅ Načteno ${items.length} produktů z XML`)
  return items
}

// ── Category hierarchy builder ─────────────────────────────────────

interface CategoryNode {
  name: string
  slug: string
  parentSlug: string | null
}

function extractCategories(items: XmlShopItem[]): CategoryNode[] {
  // Collect unique category paths like "Hovězí maso > Steak"
  const seen = new Set<string>()
  const nodes: CategoryNode[] = []

  for (const item of items) {
    const cats = toArr(item.CATEGORIES?.CATEGORY).concat(toArr(item.CATEGORIES?.DEFAULT_CATEGORY))
    for (const cat of cats) {
      const text = typeof cat === 'string' ? cat : cat['#text'] ?? String(cat)
      if (!text || seen.has(text)) continue
      seen.add(text)
      // Parse path segments: "Hovězí maso > Steak" → ["Hovězí maso", "Steak"]
      const parts = text.split('>').map((p) => p.trim()).filter(Boolean)
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i]
        const pathSoFar = parts.slice(0, i + 1).join(' > ')
        if (seen.has(`__cat:${pathSoFar}`)) continue
        seen.add(`__cat:${pathSoFar}`)
        const parentPath = i > 0 ? parts.slice(0, i).join(' > ') : null
        nodes.push({
          name,
          slug: parts.slice(0, i + 1).map(slugify).join('-'),
          parentSlug: parentPath ? parts.slice(0, i).map(slugify).join('-') : null,
        })
      }
    }
  }
  return nodes
}

// ── Main import ────────────────────────────────────────────────────

async function main() {
  // 1. Parse XML first so we know what we're importing
  const items = parseXml()

  // 2. Confirm destructive wipe
  const ok = await confirm(
    '\n⚠️  Opravdu smazat existující produkty a kategorie? [y/N] ',
  )
  if (!ok) {
    console.log('Přerušeno.')
    await prisma.$disconnect()
    return
  }

  // 3. Wipe: null-out FK references on OrderItem first, then delete data
  console.log('\n🗑️  Mazání existujících dat…')

  await prisma.orderItem.updateMany({
    data: { productId: null, variantId: null },
  })
  console.log('  ✔ OrderItem.productId / variantId → null')

  await prisma.productImage.deleteMany()
  console.log('  ✔ ProductImage')

  await prisma.productVariant.deleteMany()
  console.log('  ✔ ProductVariant')

  await prisma.product.deleteMany()
  console.log('  ✔ Product')

  await prisma.category.deleteMany()
  console.log('  ✔ Category')

  // 4. Create categories (topological order: parents first)
  console.log('\n📂 Vytváření kategorií…')
  const categoryNodes = extractCategories(items)

  // slugMap: slug → DB id
  const slugMap = new Map<string, string>()

  // Insert parents before children (nodes are already ordered by path depth)
  for (const node of categoryNodes) {
    const parentId = node.parentSlug ? slugMap.get(node.parentSlug) ?? null : null
    const cat = await prisma.category.create({
      data: {
        name: node.name,
        slug: node.slug,
        parentId,
        isActive: true,
        sortOrder: 0,
      },
    })
    slugMap.set(node.slug, cat.id)
  }
  console.log(`  ✔ Vytvořeno ${categoryNodes.length} kategorií`)

  // 5. Import products
  console.log('\n📦 Importuji produkty…')

  let created = 0
  let skipped = 0

  for (const item of items) {
    const shoptetId = String(item['@_id'])
    const name = String(item.NAME ?? '').trim()
    if (!name) {
      console.warn(`  ⚠️  Produkt id=${shoptetId} bez názvu – přeskočen`)
      skipped++
      continue
    }

    try {
      // Determine product-level price and VAT (from first variant or top-level)
      const variants = toArr(item.VARIANTS?.VARIANT)
      const firstVariant = variants[0]

      const vatRaw = firstVariant?.VAT ?? item.VAT ?? 12
      const vatRate = parseFloat(String(vatRaw)) || 12

      const priceVatRaw = firstVariant?.PRICE_VAT ?? item.PRICE_VAT ?? 0
      const priceWithVat = parseFloat(String(priceVatRaw)) || 0
      const priceWithoutVat = vatRate > 0
        ? Math.round((priceWithVat / (1 + vatRate / 100)) * 100) / 100
        : priceWithVat

      // Determine unit from first variant UNIT field
      const unitRaw = (firstVariant?.UNIT ?? 'kg').toLowerCase()
      // "kg" → KG, "ks" → KS — our schema uses KG for all weight-based meat
      const unit = unitRaw === 'ks' ? 'KS' : 'KG'
      const isWeightBased = unit !== 'KS'

      // Stock
      const stockRaw = firstVariant?.STOCK?.AMOUNT ?? item.STOCK?.AMOUNT ?? 0
      const stockQuantity = parseInt(String(stockRaw)) || 0

      // Visibility
      const visible = parseInt(String(item.VISIBLE ?? '1')) === 1

      // Flags
      const flags = toArr(item.FLAGS?.FLAG)
      const isNew = flags.some((f) => String(f.CODE) === 'new' && String(f.ACTIVE) === '1')
      const isFeatured = flags.some((f) => String(f.CODE) === 'tip' && String(f.ACTIVE) === '1')
      const isOnSale = flags.some((f) => String(f.CODE) === 'action' && String(f.ACTIVE) === '1')

      // Category: prefer DEFAULT_CATEGORY, fall back to first CATEGORY
      const defaultCats = toArr(item.CATEGORIES?.DEFAULT_CATEGORY)
      const allCats = toArr(item.CATEGORIES?.CATEGORY)
      const catEntry = defaultCats[0] ?? allCats[0]
      const catText = catEntry ? (typeof catEntry === 'string' ? catEntry : catEntry['#text'] ?? '') : ''
      const catParts = catText.split('>').map((p) => p.trim()).filter(Boolean)
      const catSlug = catParts.map(slugify).join('-')
      const categoryId = catSlug ? slugMap.get(catSlug) : undefined

      if (!categoryId) {
        console.warn(`  ⚠️  Produkt „${name}" (${shoptetId}) – kategorie „${catText}" nenalezena v DB, přeskočen`)
        skipped++
        continue
      }

      // Slug: prefer name-based; ensure uniqueness by appending shoptetId if needed
      let slug = slugify(name)

      // Descriptions (strip CDATA wrapper if present)
      const stripCdata = (v: unknown): string => {
        if (!v) return ''
        const s = String(v)
        return s.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
      }
      const shortDescription = stripCdata(item.SHORT_DESCRIPTION)
      const description = stripCdata(item.DESCRIPTION)

      // Create product
      const product = await prisma.product.create({
        data: {
          sku: shoptetId,
          slug,
          name,
          shortDescription: shortDescription || null,
          description: description || null,
          priceWithVat,
          priceWithoutVat,
          vatRate,
          unit: unit as 'KS' | 'KG' | 'G_100' | 'L' | 'ML_100',
          isWeightBased,
          stockQuantity,
          stockStatus: stockQuantity > 5 ? 'IN_STOCK' : stockQuantity > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK',
          trackStock: true,
          categoryId,
          isNew,
          isFeatured,
          isOnSale,
          isActive: visible,
          publishedAt: visible ? new Date() : null,
        },
      })

      // Images
      const images = toArr(item.IMAGES?.IMAGE)
      let imgIndex = 0
      for (const img of images) {
        const url = typeof img === 'string' ? img : img['#text'] ?? ''
        const altText = typeof img === 'object' ? (img['@_description'] ?? null) : null
        if (!url) continue
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url,
            altText: altText ? String(altText) : null,
            sortOrder: imgIndex,
            isPrimary: imgIndex === 0,
          },
        })
        imgIndex++
      }

      // Variants (skip if only 1 variant and it's essentially the product itself)
      if (variants.length > 1) {
        let sortOrder = 0
        for (const v of variants) {
          const variantSku = String(v.CODE ?? '').trim()
          if (!variantSku) continue

          // Parse weight from PARAMETERS > PARAMETER[NAME=Váha]
          const params = toArr(v.PARAMETERS?.PARAMETER)
          const weightParam = params.find((p) => String(p.NAME).trim() === 'Váha')
          const weightKg = weightParam ? parseWeightKg(String(weightParam.VALUE)) : null

          // Variant name from weight or SKU suffix
          const variantName = weightKg !== null ? formatWeight(weightKg) : variantSku

          const vPriceVat = parseFloat(String(v.PRICE_VAT ?? 0)) || 0
          const vVatRate = parseFloat(String(v.VAT ?? vatRate)) || vatRate
          const vPriceNoVat = vVatRate > 0
            ? Math.round((vPriceVat / (1 + vVatRate / 100)) * 100) / 100
            : vPriceVat

          const vStock = parseInt(String(v.STOCK?.AMOUNT ?? 0)) || 0

          await prisma.productVariant.create({
            data: {
              productId: product.id,
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

      created++
      process.stdout.write(`  [${created}/${items.length}] ${name}\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Handle duplicate slug
      if (msg.includes('Unique constraint') && msg.includes('slug')) {
        // Retry with shoptetId suffix
        try {
          const slug = `${slugify(name)}-${shoptetId}`
          const vatRaw = toArr(item.VARIANTS?.VARIANT)[0]?.VAT ?? item.VAT ?? 12
          const vatRate = parseFloat(String(vatRaw)) || 12
          const priceVatRaw = toArr(item.VARIANTS?.VARIANT)[0]?.PRICE_VAT ?? item.PRICE_VAT ?? 0
          const priceWithVat = parseFloat(String(priceVatRaw)) || 0
          const priceWithoutVat = vatRate > 0
            ? Math.round((priceWithVat / (1 + vatRate / 100)) * 100) / 100
            : priceWithVat
          const defaultCats = toArr(item.CATEGORIES?.DEFAULT_CATEGORY)
          const allCats = toArr(item.CATEGORIES?.CATEGORY)
          const catEntry = defaultCats[0] ?? allCats[0]
          const catText = catEntry ? (typeof catEntry === 'string' ? catEntry : catEntry['#text'] ?? '') : ''
          const catParts = catText.split('>').map((p: string) => p.trim()).filter(Boolean)
          const catSlug = catParts.map(slugify).join('-')
          const categoryId = slugMap.get(catSlug)
          if (!categoryId) throw new Error('no categoryId')
          const unitRaw = (toArr(item.VARIANTS?.VARIANT)[0]?.UNIT ?? 'kg').toLowerCase()
          const unit = unitRaw === 'ks' ? 'KS' : 'KG'
          await prisma.product.create({
            data: {
              sku: String(item['@_id']),
              slug,
              name: String(item.NAME ?? '').trim(),
              priceWithVat,
              priceWithoutVat,
              vatRate,
              unit: unit as 'KS' | 'KG',
              isWeightBased: unit !== 'KS',
              stockQuantity: 0,
              stockStatus: 'OUT_OF_STOCK',
              trackStock: true,
              categoryId,
              isActive: false,
            },
          })
          created++
          process.stdout.write(`  [${created}/${items.length}] ${name} (slug dedup)\n`)
        } catch (retryErr) {
          console.error(`  ❌ Produkt „${name}" (${shoptetId}) – retry selhal: ${retryErr}`)
          skipped++
        }
      } else {
        console.error(`  ❌ Produkt „${name}" (${shoptetId}) – chyba: ${msg}`)
        skipped++
      }
    }
  }

  // 6. Summary
  console.log('\n' + '─'.repeat(50))
  console.log(`✅ Import dokončen!`)
  console.log(`   Produkty importovány : ${created}`)
  console.log(`   Přeskočeny           : ${skipped}`)
  console.log(`   Kategorie            : ${categoryNodes.length}`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
