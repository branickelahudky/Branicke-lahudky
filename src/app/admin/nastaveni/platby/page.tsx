import { prisma } from '@/lib/prisma'
import { paypalConfigured, paypalMode } from '@/lib/paypal'
import { PlatbyClient, type SerializedPaymentMethod } from './PlatbyClient'

async function seed() {
  await prisma.paymentMethod.createMany({
    data: [
      {
        code: 'PM_TRANSFER',
        name: 'Bankovní převod',
        feeWithVat: 0,
        feeWithoutVat: 0,
        vatRate: 21,
        type: 'transfer',
        sortOrder: 1,
        isActive: true,
      },
      {
        code: 'PM_CARD',
        name: 'Platební karta',
        feeWithVat: 0,
        feeWithoutVat: 0,
        vatRate: 21,
        type: 'card',
        sortOrder: 2,
        isActive: true,
      },
      {
        code: 'PM_CASH',
        name: 'Hotovost (na výdejně)',
        feeWithVat: 0,
        feeWithoutVat: 0,
        vatRate: 21,
        type: 'cash',
        sortOrder: 3,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  })
}

export default async function PlatbyPage() {
  const count = await prisma.paymentMethod.count()
  if (count === 0) await seed()

  const raw = await prisma.paymentMethod.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { orders: true } } },
  })

  const methods: SerializedPaymentMethod[] = raw.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    feeWithVat: m.feeWithVat.toNumber(),
    vatRate: m.vatRate.toNumber(),
    type: m.type,
    provider: m.provider,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    orderCount: m._count.orders,
  }))

  // Stav PayPal integrace (jen indikace — klíče se nastavují v env)
  const paypalEnv = paypalConfigured()
    ? { configured: true as const, mode: paypalMode() }
    : { configured: false as const, mode: null }

  return <PlatbyClient methods={methods} paypalEnv={paypalEnv} />
}
