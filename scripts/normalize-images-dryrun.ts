/**
 * DRY-RUN: Plán hromadné normalizace produktových fotek v R2 na čtverec 800×800.
 * POUZE ČTENÍ + lokální preview. Žádný zápis do R2 ani DB.
 * Použití: npx tsx --env-file=.env scripts/normalize-images-dryrun.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})
const BUCKET = process.env.S3_BUCKET!
const PUBLIC_URL = process.env.S3_PUBLIC_URL!
const PREVIEW_DIR = path.resolve(__dirname, '_preview')
const TARGET_SIZE = 800
const THUMB_SIZE  = 400

async function fetchFromR2(key: string): Promise<Buffer | null> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const chunks: Buffer[] = []
    for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk)
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}

async function getImageDimensions(key: string): Promise<{ width: number; height: number; size: number } | null> {
  const buf = await fetchFromR2(key)
  if (!buf) return null
  try {
    const meta = await sharp(buf).metadata()
    return { width: meta.width ?? 0, height: meta.height ?? 0, size: buf.length }
  } catch {
    return null
  }
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

function isSquare800(w: number, h: number) {
  return w === TARGET_SIZE && h === TARGET_SIZE
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  DRY-RUN: Normalizace produktových fotek na čtverec 800×800  ║')
  console.log('║  POUZE ČTENÍ — žádný zápis do R2 ani DB                     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // ── 1. Přehled fotek z DB ─────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('1. FOTKY V DB (ProductImage)')
  console.log('════════════════════════════════════════════════════════════════\n')

  const dbImages = await prisma.productImage.findMany({
    select: {
      id: true, storageKey: true, thumbnailKey: true,
      url: true, thumbnailUrl: true,
      width: true, height: true, fileSize: true,
      product: { select: { name: true, sku: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`  Celkem záznamů ProductImage v DB: ${dbImages.length}`)

  // Fotky s rozměry v DB (nastaven width/height)
  const withDims = dbImages.filter(i => i.width > 0 && i.height > 0)
  const withoutDims = dbImages.filter(i => i.width === 0 || i.height === 0)
  console.log(`  Záznamy s rozměry v DB (width/height):      ${withDims.length}`)
  console.log(`  Záznamy BEZ rozměrů v DB (nutno změřit):    ${withoutDims.length}`)

  // Ukázka prvních 10 fotek
  console.log('\n  Ukázka prvních 10 fotek:')
  console.log('  ' + '─'.repeat(70))
  for (const img of dbImages.slice(0, 10)) {
    const w = img.width, h = img.height
    const dims = w > 0 ? `${w}×${h}` : '?×?'
    const square = w > 0 ? (isSquare800(w, h) ? '✓ 800×800' : `⚠ ${dims}`) : '? neznámé'
    console.log(`  ${img.product.name.slice(0, 35).padEnd(35)} | ${dims.padEnd(8)} | ${fmtBytes(img.fileSize).padEnd(9)} | ${square}`)
  }
  console.log()

  // ── 2. Analýza: které potřebují normalizaci ───────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('2. ANALÝZA — kolik fotek potřebuje normalizaci')
  console.log('════════════════════════════════════════════════════════════════\n')

  // Změř náhodný vzorek fotek bez rozměrů v DB (max 5, ze stávajících dat)
  let needNorm = 0, alreadyOk = 0, unknown = 0
  const sampleNeeded: typeof dbImages = []

  for (const img of withDims) {
    if (isSquare800(img.width, img.height)) alreadyOk++
    else { needNorm++; if (sampleNeeded.length < 5) sampleNeeded.push(img) }
  }
  unknown = withoutDims.length

  console.log(`  Již normalizované (800×800):     ${alreadyOk}`)
  console.log(`  Potřebují normalizaci (≠800×800): ${needNorm}`)
  console.log(`  Neznámé rozměry (nutno změřit):  ${unknown}`)
  console.log()

  if (unknown > 0) {
    console.log(`  ℹ️  Pro ${unknown} fotek bez rozměrů v DB by se musely stáhnout z R2 pro měření.`)
    console.log(`     V ostrém skriptu se změří před přerazítkováním.\n`)
  }

  if (sampleNeeded.length > 0) {
    console.log('  Ukázka fotek co potřebují normalizaci:')
    for (const img of sampleNeeded) {
      console.log(`    • ${img.product.name} — ${img.width}×${img.height}`)
    }
    console.log()
  }

  // ── 3. Preview na jedné fotce ─────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('3. PREVIEW — ukázka výsledku normalizace (lokálně)')
  console.log('════════════════════════════════════════════════════════════════\n')

  // Vyber první fotku, která NENÍ čtverec 800×800 (nebo první bez info)
  const previewCandidate = dbImages.find(i => !isSquare800(i.width, i.height) && i.storageKey)
    ?? dbImages[0]

  if (!previewCandidate || !previewCandidate.storageKey) {
    console.log('  ⚠️  Nepodařilo se najít vhodnou fotku pro preview.\n')
  } else {
    console.log(`  Stahuje se z R2: ${previewCandidate.storageKey}`)
    console.log(`  Produkt: ${previewCandidate.product.name}`)
    console.log(`  Rozměry v DB: ${previewCandidate.width}×${previewCandidate.height}`)
    console.log()

    const buf = await fetchFromR2(previewCandidate.storageKey)
    if (!buf) {
      console.log('  ⚠️  Nepodařilo se stáhnout soubor z R2.\n')
    } else {
      const originalMeta = await sharp(buf).metadata()
      console.log(`  Originál skutečné rozměry: ${originalMeta.width}×${originalMeta.height}, ${fmtBytes(buf.length)}`)

      // Normalizace
      const WHITE = { r: 255, g: 255, b: 255, alpha: 1 as const }
      const [mainBuf, thumbBuf] = await Promise.all([
        sharp(buf)
          .rotate()
          .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'contain', background: WHITE })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer(),
        sharp(buf)
          .rotate()
          .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: WHITE })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 82, progressive: true })
          .toBuffer(),
      ])

      const mainMeta  = await sharp(mainBuf).metadata()
      const thumbMeta = await sharp(thumbBuf).metadata()

      // Ulož lokálně jako preview
      if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true })
      const previewMain  = path.join(PREVIEW_DIR, 'preview-main-800x800.jpg')
      const previewThumb = path.join(PREVIEW_DIR, 'preview-thumb-400x400.jpg')
      fs.writeFileSync(previewMain, mainBuf)
      fs.writeFileSync(previewThumb, thumbBuf)

      console.log(`  ✓ Po normalizaci (hlavní):  ${mainMeta.width}×${mainMeta.height}, ${fmtBytes(mainBuf.length)}`)
      console.log(`  ✓ Po normalizaci (thumbnail): ${thumbMeta.width}×${thumbMeta.height}, ${fmtBytes(thumbBuf.length)}`)
      console.log()
      console.log(`  📁 Lokální preview uloženy (otevřete v prohlížeči):`)
      console.log(`     Hlavní:    ${previewMain}`)
      console.log(`     Thumbnail: ${previewThumb}`)
    }
  }
  console.log()

  // ── 4. Plán ostrého spuštění ──────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('4. PLÁN OSTRÉHO SPUŠTĚNÍ')
  console.log('════════════════════════════════════════════════════════════════\n')

  const toProcess = needNorm + unknown
  console.log(`  Co se stane při ostrém spuštění:`)
  console.log(`  • Pro každý záznam ProductImage (${dbImages.length} ks):`)
  console.log(`    1. Stáhne originál z R2 (storageKey)`)
  console.log(`    2. Zpracuje Sharpem: contain 800×800 + bílé pozadí + flatten + JPEG 85`)
  console.log(`    3. Thumbnail: contain 400×400 + bílé pozadí + flatten + JPEG 82`)
  console.log(`    4. PŘEPÍŠE soubory na STEJNÝCH R2 klíčích (storageKey / thumbnailKey)`)
  console.log(`    5. Aktualizuje ProductImage.width, height, fileSize v DB`)
  console.log()
  console.log(`  Odhadovaný počet k přerazítkování: ~${toProcess} fotek (${alreadyOk} už je ok)`)
  console.log(`  Odhadovaný čas: ~${Math.ceil(toProcess * 3 / 60)} minut (cca 3s/fotka)`)
  console.log()

  // ── 5. VAROVÁNÍ ───────────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('5. ⚠️  VAROVÁNÍ')
  console.log('════════════════════════════════════════════════════════════════\n')
  console.log('  ⚠️  OPERACE JE NEVRATNÁ — originály v R2 se přepíší.')
  console.log('  ⚠️  Cloudflare R2 nemá vestavěnou historii verzí.')
  console.log('  ⚠️  Doporučení před ostrým spuštěním:')
  console.log('       1. Stáhněte lokální zálohu fotek z R2 (nebo ověřte, že')
  console.log('          máte originály v Shooptetu / na jiném místě).')
  console.log('       2. Spusťte skript nejprve na 1-2 produktech (parametr')
  console.log('          --limit 2) a ověřte výsledek na webu.')
  console.log('       3. Po úspěšném ověření spusťte hromadně.')
  console.log('  ⚠️  DB záznamy (URL) se NEMĚNÍ — R2 klíče zůstávají stejné,')
  console.log('       jen se přepíše obsah souboru. CDN cache může být nutno')
  console.log('       invalidovat (Cloudflare Dashboard → Caching → Purge).')
  console.log()

  console.log('════════════════════════════════════════════════════════════════')
  console.log('=== DRY-RUN. V R2 ANI DB NEBYLO NIC ZMĚNĚNO. ===')
  console.log('════════════════════════════════════════════════════════════════')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Chyba:', err)
  await prisma.$disconnect()
  process.exit(1)
})
