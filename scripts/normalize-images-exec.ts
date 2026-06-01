/**
 * OSTRÁ NORMALIZACE: přepisuje produktové fotky v R2 na čtverec 800×800.
 * ⚠️  PŘEPISUJE SOUBORY V R2. Záloha se ukládá do scripts/_backup_images/.
 *
 * Použití:
 *   npx tsx --env-file=.env scripts/normalize-images-exec.ts --limit 2
 *   npx tsx --env-file=.env scripts/normalize-images-exec.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
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
const BUCKET     = process.env.S3_BUCKET!
const BACKUP_DIR = path.resolve(__dirname, '_backup_images')
const TARGET_SIZE = 800
const THUMB_SIZE  = 400
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 as const }

// ── Helpers ────────────────────────────────────────────────────────

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
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: body, ContentType: 'image/jpeg',
  }))
}

function backupPath(storageKey: string): string {
  // Zachovej strukturu: products/ID/hex.jpg → _backup_images/products/ID/hex.jpg
  return path.join(BACKUP_DIR, storageKey.replace(/\//g, path.sep))
}

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

async function backupFile(key: string, buf: Buffer): Promise<boolean> {
  const dest = backupPath(key)
  if (fs.existsSync(dest)) return false // záloha už existuje → nepřepisuj
  ensureDir(dest)
  fs.writeFileSync(dest, buf)
  return true
}

async function normalizeBuffer(buf: Buffer, size: number, quality: number): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize(size, size, { fit: 'contain', background: WHITE })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality, progressive: true })
    .toBuffer()
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  // Parsuj --limit
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : undefined

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  OSTRÁ NORMALIZACE FOTEK — čtverec 800×800, bílé pozadí     ║')
  console.log('║  ⚠️  PŘEPISUJE SOUBORY V R2                                   ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  if (limit) console.log(`\n  Režim: --limit ${limit} (zpracuje jen ${limit} fotek)`)
  else       console.log('\n  Režim: bez limitu (všechny fotky)')
  console.log()

  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  // Načti všechny ProductImage
  const allImages = await prisma.productImage.findMany({
    orderBy: { createdAt: 'asc' },
    include: { product: { select: { name: true, sku: true } } },
  })
  console.log(`  Celkem fotek v DB: ${allImages.length}`)

  const toProcess = limit ? allImages.slice(0, limit) : allImages
  console.log(`  Ke zpracování:     ${toProcess.length}\n`)

  // ── Statistiky ──
  let processed = 0
  let skipped   = 0
  let backedUp  = 0
  const errors: Array<{ name: string; sku: string; reason: string }> = []

  // ── Smyčka ─────────────────────────────────────────────────────

  for (let i = 0; i < toProcess.length; i++) {
    const img = toProcess[i]
    const label = `[${i + 1}/${toProcess.length}] ${img.product.name} (${img.product.sku})`

    // Přeskoč už normalizované
    if (img.width === TARGET_SIZE && img.height === TARGET_SIZE) {
      process.stdout.write(`${label}\n  → přeskočeno (již ${TARGET_SIZE}×${TARGET_SIZE})\n\n`)
      skipped++
      continue
    }

    process.stdout.write(`${label}\n`)

    try {
      // ── Stáhni originály ──────────────────────────────────────
      const mainBuf  = await downloadR2(img.storageKey)
      let   thumbBuf: Buffer | null = null
      if (img.thumbnailKey) {
        try { thumbBuf = await downloadR2(img.thumbnailKey) } catch { /* thumbnail nemusí existovat */ }
      }

      // ── Záloha (jen poprvé) ──────────────────────────────────
      const savedMain  = await backupFile(img.storageKey, mainBuf)
      const savedThumb = thumbBuf && img.thumbnailKey
        ? await backupFile(img.thumbnailKey, thumbBuf)
        : false
      if (savedMain)  backedUp++
      if (savedThumb) backedUp++

      process.stdout.write(`  Záloha: ${savedMain ? '✓' : 'přeskočena (existuje)'} (main) | ${savedThumb ? '✓' : 'přeskočena/chybí'} (thumb)\n`)

      // ── Normalizace ──────────────────────────────────────────
      const [newMain, newThumb] = await Promise.all([
        normalizeBuffer(mainBuf, TARGET_SIZE, 85),
        thumbBuf ? normalizeBuffer(thumbBuf, THUMB_SIZE, 82) : normalizeBuffer(mainBuf, THUMB_SIZE, 82),
      ])

      // ── Upload do R2 ──────────────────────────────────────────
      const uploadTasks: Promise<void>[] = [uploadR2(img.storageKey, newMain)]
      if (img.thumbnailKey) uploadTasks.push(uploadR2(img.thumbnailKey, newThumb))
      await Promise.all(uploadTasks)

      // ── Aktualizuj DB ─────────────────────────────────────────
      await prisma.productImage.update({
        where: { id: img.id },
        data: { width: TARGET_SIZE, height: TARGET_SIZE, fileSize: newMain.length },
      })

      process.stdout.write(`  → OK (${fmtBytes(mainBuf.length)} → ${fmtBytes(newMain.length)}, main+thumb přepsány)\n\n`)
      processed++

    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 120) : String(err)
      process.stdout.write(`  → ✗ CHYBA: ${reason}\n\n`)
      errors.push({ name: img.product.name, sku: img.product.sku, reason })
    }
  }

  // ── Souhrn ──────────────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('SOUHRN')
  console.log('════════════════════════════════════════════════════════════════\n')
  console.log(`  Zpracováno (přepsáno):    ${processed}`)
  console.log(`  Přeskočeno (již 800×800): ${skipped}`)
  console.log(`  Chyby:                    ${errors.length}`)
  console.log(`  Souborů zazálohováno:     ${backedUp}`)
  console.log(`  Záloha uložena do:        ${BACKUP_DIR}`)

  if (errors.length > 0) {
    console.log('\n  ⚠️  Chyby (fotky k ručnímu ošetření):')
    for (const e of errors) {
      console.log(`    • ${e.name} (${e.sku}): ${e.reason}`)
    }
  }

  console.log()
  console.log('  ℹ️  Připomenutí: soubory v R2 jsou přepsány.')
  console.log('     Pokud prohlížeč stále vidí staré fotky, proveď tvrdý')
  console.log('     reload (Ctrl+Shift+R) nebo purge CDN cache v Cloudflare.')
  console.log()

  if (!limit) {
    console.log('  ✅ Všechny fotky zpracovány.')
  } else {
    console.log(`  ℹ️  Zpracován limit ${limit} fotek. Pro zbývající spusť bez --limit.`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('\nFatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
