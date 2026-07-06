// GET /api/search?q=... — našeptávač produktů (contains v name + sku)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { activeSalePrice } from '@/lib/pricing'

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
    take: 8,
    select: {
      id: true, slug: true, sku: true, name: true,
      priceWithVat: true, salePriceWithVat: true, isOnSale: true, isWeightBased: true,
      saleStartsAt: true, saleEndsAt: true,
      images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true, fileSize: true }, take: 1 },
    },
  })

  // Platnost akce se vyhodnotí tady (sdílená logika) — klientovi posíláme
  // salePriceWithVat jen když akce právě PLATÍ
  const results = products.map((p) => {
    const sale = activeSalePrice({
      isOnSale: p.isOnSale,
      salePriceWithVat: p.salePriceWithVat ? Number(p.salePriceWithVat) : null,
      saleStartsAt: p.saleStartsAt,
      saleEndsAt: p.saleEndsAt,
    })
    return {
    id: p.id, slug: p.slug, sku: p.sku, name: p.name,
    priceWithVat: Number(p.priceWithVat),
    salePriceWithVat: sale,
    isOnSale: sale !== null,
    isWeightBased: p.isWeightBased,
    thumbnailUrl: (() => {
      const img = p.images[0]
      if (!img) return null
      const base = img.thumbnailUrl || img.url
      return img.fileSize > 0 ? `${base}?v=${img.fileSize}` : base
    })(),
    }
  })

  return NextResponse.json({ results })
}
