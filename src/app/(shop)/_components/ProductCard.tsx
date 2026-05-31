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
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function unitLabel(unit: string): string {
  switch (unit) {
    case 'KG':    return '/kg'
    case 'G_100': return '/100 g'
    case 'L':     return '/l'
    case 'ML_100':return '/100 ml'
    default:      return ''
  }
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const pricePerKg = product.unit === 'G_100' && product.weightGrams
    ? product.priceWithVat / (product.weightGrams / 1000)
    : null

  const badge = product.isOnSale ? { label: 'Sleva', cls: 'bg-red-500 text-white' }
    : product.isNew          ? { label: 'Novinka', cls: 'bg-gold text-shop-bg' }
    : null

  return (
    // Pevná šířka: mobil ~2 karty viditelně, sm+ ~6 na desktopu
    <Link
      href={`/produkty/${product.slug}`}
      className="
        group relative flex shrink-0 flex-col snap-start
        w-[47vw] sm:w-44
        rounded-xl bg-white overflow-hidden
        transition hover:shadow-lg hover:shadow-black/40
      "
    >
      {/* Fotka */}
      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
        {product.thumbnailUrl ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            className="object-cover object-center"
            sizes="(max-width: 640px) 47vw, 176px"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-stone-100">
            <svg className="h-8 w-8 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badge */}
        {badge && (
          <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        )}

        {/* Plus tlačítko */}
        <div className="absolute bottom-1.5 right-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-shop-bg text-lg font-bold shadow transition group-hover:scale-110">
            +
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-2">
        <h3 className="line-clamp-2 text-xs font-semibold text-stone-900 leading-snug">
          {product.name}
        </h3>

        <div className="mt-auto pt-1.5">
          <p className="text-sm font-bold text-stone-900 leading-tight">
            {product.isWeightBased && product.priceWithVat > 0 ? 'od ' : ''}
            {product.priceWithVat > 0 ? formatKc(product.priceWithVat) : '—'}
            <span className="ml-0.5 text-[10px] font-normal text-stone-500">
              {unitLabel(product.unit)}
            </span>
          </p>
          {pricePerKg && pricePerKg > 0 && (
            <p className="text-[10px] text-stone-400">≈ {formatKc(pricePerKg)}/kg</p>
          )}
        </div>
      </div>
    </Link>
  )
}
