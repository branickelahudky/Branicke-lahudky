import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ProductCard, type ProductCardData } from '../_components/ProductCard'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export const metadata: Metadata = {
  title: 'Vyhledávání',
  robots: { index: false },
}

export default async function HledatPage({ searchParams }: Props) {
  const { q } = await searchParams
  const term = (q ?? '').trim()

  const products =
    term.length >= 2
      ? await prisma.product.findMany({
          where: {
            isActive: true,
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { sku: { contains: term, mode: 'insensitive' } },
            ],
          },
          orderBy: { name: 'asc' },
          take: 48,
          select: {
            id: true, slug: true, sku: true, name: true,
            priceWithVat: true, priceWithoutVat: true, vatRate: true,
            salePriceWithVat: true,
            isWeightBased: true, unit: true, weightGrams: true,
            isNew: true, isOnSale: true, isFeatured: true,
            stockQuantity: true, stockStatus: true, trackStock: true,
            images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true, fileSize: true }, take: 1 },
          },
        })
      : []

  const cards: ProductCardData[] = products.map((p) => ({
    id: p.id, slug: p.slug, sku: p.sku, name: p.name,
    priceWithVat: Number(p.priceWithVat),
    priceWithoutVat: Number(p.priceWithoutVat),
    vatRate: Number(p.vatRate),
    salePriceWithVat: p.salePriceWithVat ? Number(p.salePriceWithVat) : null,
    isWeightBased: p.isWeightBased,
    unit: p.unit, weightGrams: p.weightGrams,
    isNew: p.isNew, isOnSale: p.isOnSale, isFeatured: p.isFeatured,
    stockQuantity: p.stockQuantity,
    stockStatus: p.stockStatus,
    trackStock: p.trackStock,
    thumbnailUrl: (() => {
      const img = p.images[0]
      if (!img) return null
      const base = img.thumbnailUrl || img.url
      return img.fileSize > 0 ? `${base}?v=${img.fileSize}` : base
    })(),
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="text-3xl font-bold text-shop-fg">
          {term ? <>Výsledky pro „{term}"</> : 'Vyhledávání'}
        </h1>
        {term.length >= 2 && (
          <span className="text-sm text-shop-muted">{cards.length} produktů</span>
        )}
      </div>

      {term.length < 2 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-shop-border py-20 text-center">
          <p className="text-lg font-semibold text-stone-400">Zadej hledaný výraz</p>
          <p className="mt-2 text-sm text-shop-muted">Napiš alespoň 2 znaky do vyhledávacího pole nahoře.</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-shop-border py-20 text-center">
          <p className="text-lg font-semibold text-stone-400">Nic jsme nenašli</p>
          <p className="mt-2 text-sm text-shop-muted">
            Zkus jiný výraz nebo zkontroluj překlepy.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cards.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
