// GET /api/categories - strom kategorií

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  // Načteme jen kořenové kategorie s dětmi - klasické 2-úrovňové menu jako na tvujreznik.cz
  const categories = await prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { products: { where: { isActive: true } } } },
        },
      },
      _count: { select: { products: { where: { isActive: true } } } },
    },
  })

  return NextResponse.json(categories)
}
