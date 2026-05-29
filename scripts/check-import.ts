import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.count()
  const customers = await prisma.customer.count()
  const categories = await prisma.category.count()
  const orders = await prisma.order.count()

  console.log('\n=== Stav databáze ===\n')
  console.log(`📦 Produkty:    ${products}`)
  console.log(`👥 Zákazníci:   ${customers}`)
  console.log(`📁 Kategorie:   ${categories}`)
  console.log(`🛒 Objednávky:  ${orders}`)
  console.log('')

  await prisma.$disconnect()
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
