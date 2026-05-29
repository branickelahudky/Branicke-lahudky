// Použití: npm run admin:reset-password <email> <noveHeslo>
// Příklad: npm run admin:reset-password admin@branickelahudky.cz NoveHeslo123

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const [email, newPassword] = process.argv.slice(2)

if (!email || !newPassword) {
  console.error('Použití: npm run admin:reset-password <email> <noveHeslo>')
  process.exit(1)
}

if (newPassword.length < 8) {
  console.error('❌ Heslo musí mít alespoň 8 znaků.')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.adminUser.findUnique({ where: { email } })
  if (!user) {
    console.error(`❌ Admin s e-mailem "${email}" neexistuje.`)
    process.exit(1)
  }

  const hash = await bcrypt.hash(newPassword, 12)

  await prisma.adminUser.update({
    where: { email },
    data: { passwordHash: hash },
  })

  // Invalidovat všechny aktivní session tohoto uživatele
  const { count } = await prisma.adminSession.deleteMany({
    where: { adminUserId: user.id },
  })

  console.log(`✅ Heslo pro ${user.firstName} ${user.lastName} (${user.email}) bylo změněno.`)
  if (count > 0) {
    console.log(`   Zrušeno ${count} aktivní session — uživatel se musí znovu přihlásit.`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Chyba:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
