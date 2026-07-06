// GET /api/products - výpis produktů s filtrováním
// POST /api/products - vytvoření produktu (admin)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { activeSaleWhere } from '@/lib/pricing'

const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  inStockOnly: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  onSale: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(24),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'name']).default('newest'),
})

export async function GET(req: NextRequest) {
  const params = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))

  const where = {
    isActive: true,
    publishedAt: { lte: new Date() },
    ...(params.category && { category: { slug: params.category } }),
    ...(params.search && {
      OR: [
        { name: { contains: params.search, mode: 'insensitive' as const } },
        { description: { contains: params.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(params.inStockOnly && { stockStatus: 'IN_STOCK' as const }),
    ...(params.featured && { isFeatured: true }),
    ...(params.onSale && activeSaleWhere()),
  }

  const orderBy = {
    newest: { createdAt: 'desc' as const },
    'price-asc': { priceWithVat: 'asc' as const },
    'price-desc': { priceWithVat: 'desc' as const },
    name: { name: 'asc' as const },
  }[params.sort]

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1 },
        variants: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.product.count({ where }),
  ])

  return NextResponse.json({
    items,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  })
}

const createProductSchema = z.object({
  sku: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  priceWithoutVat: z.number().positive(),
  priceWithVat: z.number().positive(),
  vatRate: z.number().default(12),
  isWeightBased: z.boolean().default(false),
  unit: z.enum(['KS', 'KG', 'G_100', 'L', 'ML_100']).default('KS'),
  categoryId: z.string(),
  stockQuantity: z.number().int().min(0).default(0),
  origin: z.string().optional(),
  ingredients: z.string().optional(),
  allergens: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen.' }, { status: 401 })
  }
  if (session.user.role === 'STAFF') {
    return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 })
  }

  const body = await req.json()
  const data = createProductSchema.parse(body)

  const product = await prisma.product.create({
    data: {
      ...data,
      publishedAt: new Date(),
    },
  })

  return NextResponse.json(product, { status: 201 })
}
