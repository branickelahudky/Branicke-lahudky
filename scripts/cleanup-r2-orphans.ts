/**
 * Smaže orphaned soubory v Cloudflare R2 (soubory bez záznamu v DB).
 * Použití: npx tsx scripts/cleanup-r2-orphans.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})

const prisma = new PrismaClient()
const BUCKET = process.env.S3_BUCKET!

async function listAllObjects(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = res.NextContinuationToken
  } while (continuationToken)

  return keys
}

async function main() {
  console.log('🔍 Vypisuji soubory z R2 (prefix: products/)...')
  const r2Keys = await listAllObjects('products/')
  console.log(`   Nalezeno ${r2Keys.length} objektů v R2.`)

  if (r2Keys.length === 0) {
    console.log('✅ R2 prázdné, nic ke smazání.')
    return
  }

  // Načti všechny klíče z DB
  console.log('📦 Načítám klíče z DB...')
  const dbImages = await prisma.productImage.findMany({
    select: { storageKey: true, thumbnailKey: true },
  })
  const dbKeys = new Set<string>()
  for (const img of dbImages) {
    if (img.storageKey) dbKeys.add(img.storageKey)
    if (img.thumbnailKey) dbKeys.add(img.thumbnailKey)
  }
  console.log(`   ${dbKeys.size} klíčů v DB.`)

  // Najdi orphans (v R2, ale ne v DB)
  const orphans = r2Keys.filter((k) => !dbKeys.has(k))
  console.log(`   Orphaned objektů: ${orphans.length}`)

  if (orphans.length === 0) {
    console.log('✅ Žádné orphaned soubory.')
    return
  }

  // Smaž po dávkách 1000 (limit AWS API)
  const batchSize = 1000
  let deleted = 0
  for (let i = 0; i < orphans.length; i += batchSize) {
    const batch = orphans.slice(i, i + batchSize)
    const res = await r2.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: batch.map((Key) => ({ Key })) },
    }))
    deleted += res.Deleted?.length ?? 0
    if (res.Errors && res.Errors.length > 0) {
      for (const err of res.Errors) {
        console.error(`  ⚠️  Chyba při mazání ${err.Key}: ${err.Message}`)
      }
    }
  }

  console.log(`✅ Smazáno ${deleted} orphaned objektů z R2.`)
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
