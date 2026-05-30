import Link from 'next/link'
import Image from 'next/image'

export type ProductCardData = {
  id: string
  slug: string
  name: string
  priceWithVat: number
  isWeightBased: boolean
  unit: string
  weightGrams: number | null
  isNew: boolean
  isOnSale: boolean
  isFeatured: boolean
  thumbnailUrl: string | null
}

function formatKc(n: number): string {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function unitLabel(unit: string): string {
  switch (unit) {
    case 'KG': return '/kg'
    case 'G_100': return '/100 g'
    case 'L': return '/l'
    case 'ML_100': return '/100 ml'
    default: return ''
  }
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const pricePerKg = product.unit === 'G_100' && product.weightGrams
    ? (product.priceWithVat / (product.weightGrams / 1000))
    : null

  const badge = product.isOnSale ? { label: 'Sleva', cls: 'bg-red-500 text-white' }
    : product.isNew ? { label: 'Novinka', cls: 'bg-gold text-shop-bg' }
    : null

  return (
    <Link href={`/produkty/${product.slug}`}
      className="group relative flex flex-col rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:shadow-black/30">

      {/* Fotka */}
      <div className="relative aspect-square bg-stone-100 overflow-hidden">
        {product.thumbnailUrl ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-stone-100">
            <svg className="h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badge */}
        {badge && (
          <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        )}

        {/* Plus tlačítko */}
        <div className="absolute bottom-2 right-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-shop-bg text-xl font-bold shadow-md transition group-hover:scale-110">
            +
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-stone-900 leading-snug">
          {product.name}
        </h3>

        <div className="mt-auto pt-2">
          <p className="text-base font-bold text-stone-900">
            {product.isWeightBased ? 'od ' : ''}
            {formatKc(product.priceWithVat)}
            <span className="ml-0.5 text-xs font-normal text-stone-500">
              {unitLabel(product.unit)}
            </span>
          </p>
          {pricePerKg && (
            <p className="text-xs text-stone-400">≈ {formatKc(pricePerKg)}/kg</p>
          )}
        </div>
      </div>
    </Link>
  )
}
