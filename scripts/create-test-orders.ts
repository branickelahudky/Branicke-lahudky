// Vytvoří 6 testovacích objednávek s různými stavy
// Spuštění: npm run db:test-orders

import { PrismaClient, OrderStatus, PaymentStatus } from '@prisma/client'

const prisma = new PrismaClient()

const ADDRESS_SNAPSHOT = {
  firstName: 'Test',
  lastName: 'Zákazník',
  street: 'Testovací 1',
  city: 'Praha 4',
  postalCode: '14000',
  country: 'CZ',
  phone: '+420777000000',
}

const ORDERS: Array<{
  suffix: string
  firstName: string
  lastName: string
  email: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  shippingCode: string
  paymentCode: string
}> = [
  {
    suffix: '001',
    firstName: 'Jana',
    lastName: 'Nováková',
    email: 'jana.novakova@example.cz',
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    total: 1240,
    shippingCode: 'PRAHA_NEXT_DAY',
    paymentCode: 'CARD_ONLINE',
  },
  {
    suffix: '002',
    firstName: 'Petr',
    lastName: 'Dvořák',
    email: 'petr.dvorak@example.cz',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    total: 890,
    shippingCode: 'PICKUP_BRANIK',
    paymentCode: 'CASH_ON_PICKUP',
  },
  {
    suffix: '003',
    firstName: 'Marie',
    lastName: 'Svobodová',
    email: 'marie.svobodova@example.cz',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    total: 3560,
    shippingCode: 'PPL_CHLAZENA',
    paymentCode: 'BANK_TRANSFER',
  },
  {
    suffix: '004',
    firstName: 'Tomáš',
    lastName: 'Procházka',
    email: 'tomas.prochazka@example.cz',
    status: 'READY',
    paymentStatus: 'PAID',
    total: 680,
    shippingCode: 'PICKUP_BRANIK',
    paymentCode: 'CASH_ON_PICKUP',
  },
  {
    suffix: '005',
    firstName: 'Lucie',
    lastName: 'Marková',
    email: 'lucie.markova@example.cz',
    status: 'DELIVERED',
    paymentStatus: 'PAID',
    total: 2100,
    shippingCode: 'PRAHA_NEXT_DAY',
    paymentCode: 'CARD_ONLINE',
  },
  {
    suffix: '006',
    firstName: 'Jan',
    lastName: 'Kratochvíl',
    email: 'jan.kratochvil@example.cz',
    status: 'CANCELLED',
    paymentStatus: 'UNPAID',
    total: 450,
    shippingCode: 'PICKUP_BRANIK',
    paymentCode: 'CASH_ON_PICKUP',
  },
]

async function main() {
  // Získej shipping a payment metody ze seedu
  const shipping = await prisma.shippingMethod.findMany({
    select: { id: true, code: true, name: true, priceWithVat: true },
  })
  const payment = await prisma.paymentMethod.findMany({
    select: { id: true, code: true, name: true },
  })

  if (shipping.length === 0 || payment.length === 0) {
    console.error('❌ Nejdřív spusť npm run db:seed (chybí shipping/payment metody).')
    process.exit(1)
  }

  const shippingMap = Object.fromEntries(shipping.map((s) => [s.code, s]))
  const paymentMap = Object.fromEntries(payment.map((p) => [p.code, p]))

  const now = new Date()
  let created = 0

  for (const o of ORDERS) {
    const orderNumber = `2605${o.suffix}`
    const existing = await prisma.order.findUnique({ where: { orderNumber } })
    if (existing) {
      console.log(`  ↳ Přeskakuji ${orderNumber} (již existuje)`)
      continue
    }

    const sm = shippingMap[o.shippingCode]
    const pm = paymentMap[o.paymentCode]

    if (!sm || !pm) {
      console.error(`❌ Neznámý kód dopravy/platby pro ${orderNumber}`)
      continue
    }

    const vatRate = 12
    const totalWithVat = o.total
    const totalWithoutVat = Math.round((totalWithVat / (1 + vatRate / 100)) * 100) / 100
    const totalVat = Math.round((totalWithVat - totalWithoutVat) * 100) / 100

    await prisma.order.create({
      data: {
        orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        contactFirstName: o.firstName,
        contactLastName: o.lastName,
        contactEmail: o.email,
        contactPhone: '+420777' + Math.floor(100000 + Math.random() * 900000),
        shippingMethodId: sm.id,
        shippingMethodName: sm.name,
        shippingPriceWithVat: Number(sm.priceWithVat),
        shippingPriceWithoutVat: Math.round((Number(sm.priceWithVat) / 1.21) * 100) / 100,
        paymentMethodId: pm.id,
        paymentMethodName: pm.name,
        shippingAddressSnapshot: ADDRESS_SNAPSHOT,
        subtotalWithoutVat: totalWithoutVat,
        subtotalWithVat: totalWithVat,
        totalWithoutVat,
        totalWithVat,
        totalVat,
        paidAt: o.paymentStatus === 'PAID' ? new Date(now.getTime() - 3600_000) : null,
        createdAt: new Date(now.getTime() - Math.random() * 7 * 24 * 3600_000),
      },
    })

    console.log(`  ✓ ${orderNumber} — ${o.firstName} ${o.lastName} (${o.status})`)
    created++
  }

  console.log(`\n✅ Vytvořeno ${created} testovacích objednávek.`)
}

main()
  .catch((e) => {
    console.error('❌ Chyba:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
