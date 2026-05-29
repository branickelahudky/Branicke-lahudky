// GET /api/payment-methods?shippingMethodId=xxx
// Vrátí platební metody dostupné pro daný způsob dopravy

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const shippingMethodId = req.nextUrl.searchParams.get('shippingMethodId')

  if (shippingMethodId) {
    const links = await prisma.paymentMethodOnShipping.findMany({
      where: { shippingMethodId },
      include: { paymentMethod: true },
    })

    const methods = links
      .map((l) => l.paymentMethod)
      .filter((m) => m.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    return NextResponse.json(methods)
  }

  const methods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json(methods)
}
