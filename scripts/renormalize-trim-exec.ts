/**
 * OSTRÝ BĚH: trim + jednotné usazení produktu (~82 %) na čtverec 800×800.
 * ⚠️  PŘEPISUJE SOUBORY V R2. Záloha → scripts/_backup_images2/.
 *
 * - main 800×800 + thumb 400×400 se odvodí z JEDNOHO trimu (z main fotky)
 * - když by trim ořízl >95 % plochy (selhání / stín / gradient) → PŘESKOČÍ
 *   a vypíše do reportu (radši přeskočit než zničit)
 * - aktualizuje width/height/fileSize v DB (změna fileSize = cache-busting ?v=)
 *
 * Použití:
 *   npx tsx --env-file=.env scripts/renormalize-trim-exec.ts --limit 5
 *   npx tsx --env-file=.env scripts/renormalize-trim-exec.ts            # vše
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'
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
const BACKUP_DIR = path.resolve(__dirname, '_backup_images2')
const TARGET = 800
const THUMB = 400

function fmtBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`
}

async function downloadR2(key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const chunks: Buffer[] = []
  for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function uploadR2(key: string, body: Buffer) {
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: 'image/jpeg' }))
}

function backupPath(key: string): string {
  return path.join(BACKUP_DIR, key.replace(/\//g, path.sep))
}

async function backupFile(key: string, buf: Buffer): Promise<boolean> {
  const dest = backupPath(key)
  if (fs.existsSync(dest)) return false
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
  return true
}

async function main() {
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : undefined

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  OSTRÝ BĚH: trim + jednotné usazení (82 %) → 800×800          ║')
  console.log('║  ⚠️  PŘEPISUJE SOUBORY V R2                                   ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`  threshold=${TRIM_THRESHOLD}  inner=${Math.round(TARGET * INNER_RATIO)}px  ${limit ? `limit=${limit}` : 'bez limitu'}`)
  console.log(`  Záloha → ${BACKUP_DIR}\n`)

  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const allImages = await prisma.productImage.findMany({
    orderBy: { createdAt: 'asc' },
    include: { product: { select: { name: true, sku: true } } },
  })
  const toProcess = limit ? allImages.slice(0, limit) : allImages
  console.log(`  Fotek v DB: ${allImages.length}, ke zpracování: ${toProcess.length}\n`)

  let processed = 0
  let backedUp = 0
  const skipped: Array<{ name: string; sku: string; reason: string }> = []
  const errors: Array<{ name: string; sku: string; reason: string }> = []

  for (let i = 0; i < toProcess.length; i++) {
    const img = toProcess[i]
    const label = `[${i + 1}/${toProcess.length}] ${img.product.name} (${img.product.sku})`
    process.stdout.write(`${label}\n`)

    try {
      const mainBuf = await downloadR2(img.storageKey)

      // Trim z hlavní fotky — main i thumb odvodíme ze stejného obsahu
      const t = await trimToContent(mainBuf)
      const kept = keptAreaRatio(t)
      if (kept < MIN_KEPT_RATIO) {
        const reason = `trim by ořízl >95 % plochy (kept ${(kept * 100).toFixed(1)} %)`
        process.stdout.write(`  → ⏭️  PŘESKOČENO: ${reason}\n\n`)
        skipped.push({ name: img.product.name, sku: img.product.sku, reason })
        continue
      }

      // Záloha aktuálních souborů (jen poprvé)
      const savedMain = await backupFile(img.storageKey, mainBuf)
      let savedThumb = false
      if (img.thumbnailKey) {
        try {
          const oldThumb = await downloadR2(img.thumbnailKey)
          savedThumb = await backupFile(img.thumbnailKey, oldThumb)
        } catch { /* thumbnail nemusí existovat */ }
      }
      if (savedMain) backedUp++
      if (savedThumb) backedUp++

      // Nové main + thumb z jednoho oříznutého obsahu
      const [newMain, newThumb] = await Promise.all([
        padToSquare(t.trimmedBuffer, TARGET, INNER_RATIO, 85),
        padToSquare(t.trimmedBuffer, THUMB, INNER_RATIO, 82),
      ])

      const tasks: Promise<void>[] = [uploadR2(img.storageKey, newMain)]
      if (img.thumbnailKey) tasks.push(uploadR2(img.thumbnailKey, newThumb))
      await Promise.all(tasks)

      await prisma.productImage.update({
        where: { id: img.id },
        data: { width: TARGET, height: TARGET, fileSize: newMain.length },
      })

      process.stdout.write(
        `  bbox ${t.bboxWidth}×${t.bboxHeight} (${(kept * 100).toFixed(0)} %) → ${fmtBytes(mainBuf.length)}→${fmtBytes(newMain.length)}  záloha:${savedMain ? '✓' : '–'}/${savedThumb ? '✓' : '–'}\n  → OK\n\n`,
      )
      processed++
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 120) : String(err)
      process.stdout.write(`  → ✗ CHYBA: ${reason}\n\n`)
      errors.push({ name: img.product.name, sku: img.product.sku, reason })
    }
  }

  console.log('════════════════════════════════════════════════════════════════')
  console.log('SOUHRN')
  console.log('════════════════════════════════════════════════════════════════')
  console.log(`  Zpracováno (přepsáno):  ${processed}`)
  console.log(`  Přeskočeno (ochrana):   ${skipped.length}`)
  console.log(`  Chyby:                  ${errors.length}`)
  console.log(`  Souborů zazálohováno:   ${backedUp}  → ${BACKUP_DIR}`)

  if (skipped.length) {
    console.log('\n  ⏭️  Přeskočené fotky (k ručnímu ošetření):')
    for (const s of skipped) console.log(`    • ${s.name} (${s.sku}): ${s.reason}`)
  }
  if (errors.length) {
    console.log('\n  ⚠️  Chyby:')
    for (const e of errors) console.log(`    • ${e.name} (${e.sku}): ${e.reason}`)
  }

  console.log('\n  ℹ️  fileSize se změnil → cache-busting ?v= zajistí refresh v prohlížeči.')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('\nFatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
