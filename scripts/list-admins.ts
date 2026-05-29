import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.adminUser.findMany({
    select: { email: true, firstName: true, lastName: true, role: true, status: true }
  })
  console.log('\n=== Admin účty v databázi ===\n')
  for (const u of users) {
    console.log(`Email:  ${u.email}`)
    console.log(`Jméno:  ${u.firstName} ${u.lastName}`)
    console.log(`Role:   ${u.role}`)
    console.log(`Status: ${u.status}`)
    console.log('---')
  }
  console.log(`\nCelkem: ${users.length} účtů\n`)
  await prisma.$disconnect()
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
