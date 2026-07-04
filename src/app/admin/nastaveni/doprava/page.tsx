import { prisma } from '@/lib/prisma'
import { DopravyClient, type SerializedShippingMethod } from './DopravyClient'

export default async function DopravyPage() {
  const raw = await prisma.shippingMethod.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { orders: true } },
      weightTiers: { orderBy: { maxWeightKg: 'asc' } },
    },
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
    usesWeightTiers: m.usesWeightTiers,
    fuelSurchargePercent: m.fuelSurchargePercent.toNumber(),
    defaultItemWeightGrams: m.defaultItemWeightGrams,
    maxWeightKg: m.maxWeightKg?.toNumber() ?? null,
    countries: m.availableCountries,
    weightTiers: m.weightTiers.map((t) => ({
      maxWeightKg: t.maxWeightKg.toNumber(),
      priceWithVat: t.priceWithVat.toNumber(),
    })),
    orderCount: m._count.orders,
  }))

  return <DopravyClient methods={methods} />
}
