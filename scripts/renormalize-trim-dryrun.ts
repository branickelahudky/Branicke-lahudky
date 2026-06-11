/**
 * DRY-RUN: trim + jednotné usazení produktu (NEzapisuje).
 * Stáhne fotku z R2, ořízne pozadí, spočítá bounding box produktu a nové
 * usazení (82 % plochy) — vypíše report. Nic nepřepisuje.
 *
 * Použití:
 *   npx tsx --env-file=.env scripts/renormalize-trim-dryrun.ts            # 5 fotek (default)
 *   npx tsx --env-file=.env scripts/renormalize-trim-dryrun.ts --limit 10
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import {
  trimToContent, padToSquare, keptAreaRatio,
  INNER_RATIO, MIN_KEPT_RATIO, TRIM_THRESHOLD,
} from '../src/lib/normalize-image'

const prisma = new PrismaClient()
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
})
const BUCKET = process.env.S3_BUCKET!
const TARGET = 800

function fmtBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`
}

async function downloadR2(key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const chunks: Buffer[] = []
  for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function main() {
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : 5

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  DRY-RUN: trim + jednotné usazení (82 %) — BEZ ZÁPISU         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`  threshold=${TRIM_THRESHOLD}  inner=${Math.round(TARGET * INNER_RATIO)}px (${Math.round(INNER_RATIO * 100)} %)  limit=${limit}\n`)

  const allImages = await prisma.productImage.findMany({
    orderBy: { createdAt: 'asc' },
    include: { product: { select: { name: true, sku: true } } },
  })
  const toProcess = allImages.slice(0, limit)
  console.log(`  Fotek v DB: ${allImages.length}, v ukázce: ${toProcess.length}\n`)

  let wouldProcess = 0
  let wouldSkip = 0

  for (let i = 0; i < toProcess.length; i++) {
    const img = toProcess[i]
    const label = `[${i + 1}/${toProcess.length}] ${img.product.name} (${img.product.sku})`
    try {
      const mainBuf = await downloadR2(img.storageKey)
      const t = await trimToContent(mainBuf)
      const kept = keptAreaRatio(t)
      const keptPct = (kept * 100).toFixed(1)

      // Spočítej, jak bude produkt usazen (jen pro report)
      const newFinal = await padToSquare(t.trimmedBuffer, TARGET, INNER_RATIO, 85)

      const skip = kept < MIN_KEPT_RATIO
      if (skip) wouldSkip++; else wouldProcess++

      console.log(label)
      console.log(`  DB rozměr:        ${img.width}×${img.height}  (${fmtBytes(img.fileSize)})`)
      console.log(`  Skutečný zdroj:   ${t.srcWidth}×${t.srcHeight}`)
      console.log(`  Bounding box:     ${t.bboxWidth}×${t.bboxHeight}  @ offset (${t.offsetLeft},${t.offsetTop})  ${t.trimmed ? '' : '(trim nic neoříznul)'}`)
      console.log(`  Produkt zabírá:   ${keptPct} % plochy zdroje`)
      console.log(`  Nové usazení:     produkt → ${Math.round(TARGET * INNER_RATIO)}px uvnitř ${TARGET}×${TARGET}, bílý okraj rovnoměrně`)
      console.log(`  Nová velikost:    ${fmtBytes(newFinal.length)}`)
      console.log(`  Rozhodnutí:       ${skip ? `⏭️  PŘESKOČIT (ořízlo by >95 % — kept ${keptPct} %)` : '✅ ZPRACOVAT'}`)
      console.log()
    } catch (err) {
      wouldSkip++
      const reason = err instanceof Error ? err.message.slice(0, 120) : String(err)
      console.log(label)
      console.log(`  → ✗ CHYBA (přeskočit): ${reason}\n`)
    }
  }

  console.log('════════════════════════════════════════════════════════════════')
  console.log(`  Zpracovalo by se: ${wouldProcess}   Přeskočilo by se: ${wouldSkip}`)
  console.log('  (DRY-RUN — nic se nezapsalo. Pro ostrý běh: renormalize-trim-exec.ts)')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('\nFatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
