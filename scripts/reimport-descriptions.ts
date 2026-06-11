/**
 * Doimport popisů produktů ze Shoptet XML.
 *
 * Původní import (import-shoptet.ts) uložil popisy jako "[object Object]",
 * protože CDATA s HTML se parserem (cdataPropName: '__cdata') naparsuje
 * jako objekt { __cdata: "<p>…" } a byl převeden přes String(obj).
 * Tento skript přečte popisy správně z .__cdata a doplní je k produktům
 * spárovaným přes SKU (= SHOPITEM @id).
 *
 * Použití:
 *   npx tsx scripts/reimport-descriptions.ts            # dry-run (jen výpis)
 *   npx tsx scripts/reimport-descriptions.ts --exec      # ostrý zápis do DB
 */

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import * as readline from 'readline'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const XML_FILE = resolve(__dirname, '../data/shoptet-export.xml')
const EXEC = process.argv.includes('--exec')

// ── Helpers ──────────────────────────────────────────────────────

/** Vytáhne text z pole, které může být string, { __cdata }, nebo { #text }. */
function extractText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('__cdata' in o && o.__cdata != null) {
      const c = o.__cdata
      const s = Array.isArray(c) ? c.map((x) => String(x)).join('') : String(c)
      return s.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    }
    if ('#text' in o && o['#text'] != null) return String(o['#text']).trim()
  }
  return ''
}

function isGarbage(s: string): boolean {
  if (!s) return true
  if (/^(\[object Object\]\s*)+$/i.test(s.trim())) return true
  return false
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close()
      res(answer.trim().toLowerCase() === 'y')
    })
  })
}

interface XmlShopItem {
  '@_id': string | number
  NAME?: unknown
  SHORT_DESCRIPTION?: unknown
  DESCRIPTION?: unknown
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
    isArray: (name) => ['SHOPITEM'].includes(name),
    allowBooleanAttributes: true,
  })
  const result = parser.parse(xml)
  const items: XmlShopItem[] = result?.SHOP?.SHOPITEM ?? []
  console.log(`✅ Načteno ${items.length} produktů z XML\n`)
  return items
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(EXEC ? '⚙️  REŽIM: OSTRÝ ZÁPIS (--exec)\n' : '🔍 REŽIM: DRY-RUN (bez zápisu, přidej --exec pro zápis)\n')

  const items = parseXml()

  // SKU → popisy z XML
  type Desc = { sku: string; name: string; short: string; long: string }
  const fromXml: Desc[] = items.map((it) => ({
    sku: String(it['@_id']),
    name: extractText(it.NAME) || '(bez názvu)',
    short: extractText(it.SHORT_DESCRIPTION),
    long: extractText(it.DESCRIPTION),
  }))

  // Produkty v DB
  const dbProducts = await prisma.product.findMany({
    select: { sku: true, shortDescription: true, description: true },
  })
  const dbBySku = new Map(dbProducts.map((p) => [p.sku, p]))

  let matched = 0
  let willUpdate = 0
  let noXmlText = 0
  let notInDb = 0
  let alreadyOk = 0
  const examples: { name: string; sku: string; short: string; long: string }[] = []
  const updates: { sku: string; short: string | null; long: string | null }[] = []

  for (const x of fromXml) {
    const db = dbBySku.get(x.sku)
    if (!db) { notInDb++; continue }
    matched++

    const newShort = !isGarbage(x.short) ? x.short : null
    const newLong = !isGarbage(x.long) ? x.long : null

    if (!newShort && !newLong) { noXmlText++; continue }

    // Aktualizuj jen pokud je v DB poškozeno/prázdno NEBO se liší od XML
    const dbShortBad = isGarbage(db.shortDescription ?? '')
    const dbLongBad = isGarbage(db.description ?? '')

    const setShort = newShort && (dbShortBad || db.shortDescription !== newShort) ? newShort : null
    const setLong = newLong && (dbLongBad || db.description !== newLong) ? newLong : null

    if (!setShort && !setLong) { alreadyOk++; continue }

    willUpdate++
    updates.push({ sku: x.sku, short: setShort, long: setLong })
    if (examples.length < 3) {
      examples.push({
        name: x.name, sku: x.sku,
        short: (setShort ?? db.shortDescription ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100),
        long: (setLong ?? db.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100),
      })
    }
  }

  console.log('═══ SOUHRN PÁROVÁNÍ ═══')
  console.log(`Produktů v XML:              ${fromXml.length}`)
  console.log(`Produktů v DB:               ${dbProducts.length}`)
  console.log(`Spárováno přes SKU:          ${matched}`)
  console.log(`  → k aktualizaci:           ${willUpdate}`)
  console.log(`  → už v pořádku (beze změny): ${alreadyOk}`)
  console.log(`  → bez textu i v XML:       ${noXmlText}`)
  console.log(`V XML, ale ne v DB:          ${notInDb}`)
  console.log('')
  console.log('═══ 3 PŘÍKLADY K AKTUALIZACI ═══')
  for (const e of examples) {
    console.log(`• ${e.name} [${e.sku}]`)
    console.log(`    short: ${e.short || '—'}`)
    console.log(`    long:  ${e.long || '—'}`)
  }
  console.log('')

  if (!EXEC) {
    console.log(`🔍 DRY-RUN: zapsalo by se ${willUpdate} produktů. Spusť s --exec pro zápis.`)
    return
  }

  if (willUpdate === 0) {
    console.log('Není co aktualizovat.')
    return
  }

  const ok = await confirm(`Zapsat ${willUpdate} aktualizací do DB? [y/N] `)
  if (!ok) {
    console.log('Zrušeno.')
    return
  }

  let done = 0
  for (const u of updates) {
    const data: { shortDescription?: string; description?: string } = {}
    if (u.short) data.shortDescription = u.short
    if (u.long) data.description = u.long
    await prisma.product.update({ where: { sku: u.sku }, data })
    done++
    if (done % 25 === 0) console.log(`  …${done}/${updates.length}`)
  }
  console.log(`\n✅ Hotovo — aktualizováno ${done} produktů.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
