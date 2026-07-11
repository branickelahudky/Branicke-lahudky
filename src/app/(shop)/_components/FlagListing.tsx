import { prisma } from '@/lib/prisma'
import { activeSaleWhere } from '@/lib/pricing'
import { ProductCard, type ProductCardData } from './ProductCard'

// Sdílený výpis produktů dle příznaku — cílová stránka regálů z homepage
// (Akce / Novinky / Doporučujeme). Řazeno dle updatedAt desc, stejně jako regály.
// Akce ukazuje jen produkty s právě AKTIVNÍ slevou (where až v době dotazu).

export type FlagKind = 'sale' | 'new' | 'featured'

const FLAG_DEFS: Record<FlagKind, { title: string; where: () => Record<string, unknown> }> = {
  sale:     { title: 'Akce',         where: () => activeSaleWhere() },
  new:      { title: 'Novinky',      where: () => ({ isNew: true }) },
  featured: { title: 'Doporučujeme', where: () => ({ isFeatured: true }) },
}

export function flagTitle(flag: FlagKind) {
  return FLAG_DEFS[flag].title
}

export async function FlagListing({ flag }: { flag: FlagKind }) {
  const def = FLAG_DEFS[flag]

  const products = await prisma.product.findMany({
    where: { isActive: true, ...def.where() },
    orderBy: { updatedAt: 'desc' },
    take: 48,
    select: {
      id: true, slug: true, sku: true, name: true,
      priceWithVat: true, priceWithoutVat: true, vatRate: true,
      salePriceWithVat: true, saleStartsAt: true, saleEndsAt: true,
      isWeightBased: true, unit: true, weightGrams: true, sellsAsWholePiece: true,
      isNew: true, isOnSale: true, isFeatured: true,
      stockQuantity: true, stockStatus: true, trackStock: true,
      images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true, fileSize: true }, take: 1 },
            _count: { select: { variants: { where: { isActive: true } } } },
    },
  })

  const cards: ProductCardData[] = products.map((p) => ({
    id: p.id, slug: p.slug, sku: p.sku, name: p.name,
    priceWithVat:    Number(p.priceWithVat),
    priceWithoutVat: Number(p.priceWithoutVat),
    vatRate:         Number(p.vatRate),
    salePriceWithVat: p.salePriceWithVat ? Number(p.salePriceWithVat) : null,
    saleStartsAt: p.saleStartsAt?.toISOString() ?? null,
    saleEndsAt: p.saleEndsAt?.toISOString() ?? null,
    isWeightBased: p.isWeightBased,
    unit: p.unit, weightGrams: p.weightGrams, sellsAsWholePiece: p.sellsAsWholePiece,
    isNew: p.isNew, isOnSale: p.isOnSale, isFeatured: p.isFeatured,
    stockQuantity: p.stockQuantity,
    stockStatus:   p.stockStatus,
    trackStock:    p.trackStock,
    hasVariants:   p._count.variants > 0,
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
        <h1 className="text-3xl font-extrabold text-shop-fg">{def.title}</h1>
        <span className="text-sm text-shop-muted">{cards.length} produktů</span>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-shop-border py-20 text-center">
          <p className="text-lg font-semibold text-stone-400">Zatím žádné produkty</p>
          <p className="mt-2 text-sm text-shop-muted">V této sekci momentálně nic není.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {cards.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {products.length === 48 && (
            <p className="mt-6 text-center text-sm text-shop-muted">
              Zobrazeno prvních 48 produktů — stránkování připravujeme.
            </p>
          )}
        </>
      )}
    </div>
  )
}
