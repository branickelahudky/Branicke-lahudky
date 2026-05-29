import { prisma } from '@/lib/prisma'
import { DopravyClient, type SerializedShippingMethod } from './DopravyClient'

async function seed() {
  await prisma.shippingMethod.createMany({
    data: [
      {
        code: 'SM_PICKUP',
        name: 'Osobní odběr – Branická 75',
        priceWithVat: 0,
        priceWithoutVat: 0,
        vatRate: 21,
        isPickup: true,
        estimatedDays: 'ihned',
        sortOrder: 1,
        isActive: true,
      },
      {
        code: 'SM_PRAGUE',
        name: 'Doručení po Praze',
        priceWithVat: 79,
        priceWithoutVat: 65.29,
        vatRate: 21,
        isPickup: false,
        estimatedDays: null,
        sortOrder: 2,
        isActive: true,
      },
      {
        code: 'SM_PPL',
        name: 'PPL – chlazená přeprava',
        priceWithVat: 149,
        priceWithoutVat: 123.14,
        vatRate: 21,
        isPickup: false,
        estimatedDays: '1–2 dny',
        sortOrder: 3,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  })
}

export default async function DopravyPage() {
  const count = await prisma.shippingMethod.count()
  if (count === 0) await seed()

  const raw = await prisma.shippingMethod.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { orders: true } } },
  })

  const methods: SerializedShippingMethod[] = raw.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    priceWithVat: m.priceWithVat.toNumber(),
    vatRate: m.vatRate.toNumber(),
    isPickup: m.isPickup,
    estimatedDays: m.estimatedDays,
    freeShippingThreshold: m.freeShippingThreshold?.toNumber() ?? null,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    orderCount: m._count.orders,
  }))

  return <DopravyClient methods={methods} />
}
