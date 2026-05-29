// GET /api/shipping-methods - dostupné způsoby dopravy
// Volitelně přijímá ?country=CZ&weightKg=2.5&orderValue=1500
// → vrátí jen vyhovující metody s informací o doprava zdarma

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') ?? 'CZ'
  const weightKg = parseFloat(req.nextUrl.searchParams.get('weightKg') ?? '0')
  const orderValue = parseFloat(req.nextUrl.searchParams.get('orderValue') ?? '0')

  const methods = await prisma.shippingMethod.findMany({
    where: {
      isActive: true,
      availableCountries: { has: country },
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      allowedPaymentMethods: {
        include: {
          paymentMethod: true,
        },
      },
    },
  })

  // Vyfiltrujeme podle hmotnosti a hodnoty objednávky a označíme doprava zdarma
  const filtered = methods
    .filter((m) => !m.maxWeightKg || Number(m.maxWeightKg) >= weightKg)
    .filter((m) => !m.maxOrderValue || Number(m.maxOrderValue) >= orderValue)
    .map((m) => {
      const isFree =
        m.freeShippingThreshold && orderValue >= Number(m.freeShippingThreshold)
      return {
        ...m,
        effectivePriceWithVat: isFree ? 0 : Number(m.priceWithVat),
        isFreeShipping: isFree,
        amountToFreeShipping:
          m.freeShippingThreshold && !isFree
            ? Number(m.freeShippingThreshold) - orderValue
            : 0,
        allowedPaymentMethods: m.allowedPaymentMethods
          .filter((p) => p.paymentMethod.isActive)
          .map((p) => p.paymentMethod),
      }
    })

  return NextResponse.json(filtered)
}
