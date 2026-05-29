import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const products = await prisma.product.findMany({
    select: { sku: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log('\n=== Pořadí importu ===\n')
  for (const p of products) {
    console.log(`${p.sku.padEnd(20)} | ${p.name}`)
  }
  await prisma.$disconnect()
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
