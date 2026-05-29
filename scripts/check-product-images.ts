import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      images: {
        select: { id: true, url: true, thumbnailUrl: true, isPrimary: true }
      }
    },
    take: 5,
  })

  console.log('\n=== Prvních 5 produktů a jejich fotky ===\n')
  for (const p of products) {
    console.log(`📦 ${p.name} (SKU: ${p.sku})`)
    if (p.images.length === 0) {
      console.log(`   ❌ ŽÁDNÉ FOTKY`)
    } else {
      for (const img of p.images) {
        console.log(`   🖼️  ${img.isPrimary ? '⭐' : '  '} ${img.url}`)
        console.log(`      thumb: ${img.thumbnailUrl}`)
      }
    }
    console.log('')
  }

  const totalProducts = await prisma.product.count()
  const totalImages = await prisma.productImage.count()
  console.log(`\nCelkem produktů: ${totalProducts}`)
  console.log(`Celkem fotek v DB: ${totalImages}\n`)

  await prisma.$disconnect()
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
