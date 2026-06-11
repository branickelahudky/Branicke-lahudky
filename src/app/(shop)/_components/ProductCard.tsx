'use client'

import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { useCart } from '../_context/CartContext'

export type ProductCardData = {
  id: string
  slug: string
  sku: string
  name: string
  priceWithVat: number
  priceWithoutVat: number
  vatRate: number
  salePriceWithVat: number | null
  isWeightBased: boolean
  unit: string
  weightGrams: number | null
  isNew: boolean
  isOnSale: boolean
  isFeatured: boolean
  stockStatus: string
  stockQuantity: number
  trackStock: boolean
  thumbnailUrl: string | null
}

function fmtKc(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { addItem } = useCart()

  const isAvailable = product.stockStatus !== 'OUT_OF_STOCK'
  const hasPrice    = product.priceWithVat > 0

  const activeSalePrice =
    product.isOnSale && product.salePriceWithVat && product.salePriceWithVat > 0
      ? product.salePriceWithVat
      : null
  const displayPrice = activeSalePrice ?? product.priceWithVat
  const prefix = product.isWeightBased ? 'od ' : ''

  const badge = product.isOnSale ? { label: 'Akce',    cls: 'bg-red-500 text-white' }
    : product.isNew              ? { label: 'Novinka', cls: 'bg-gold text-shop-bg'  }
    : product.isFeatured         ? { label: 'Tip',     cls: 'bg-blue-600 text-white' }
    : null

  const weightLabel = product.weightGrams
    ? product.weightGrams >= 1000
      ? `${(product.weightGrams / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg`
      : `${product.weightGrams} g`
    : null

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isAvailable || !hasPrice) return
    addItem({
      productId: product.id,
      slug:      product.slug,
      sku:       product.sku,
      name:      product.name,
      thumbnailUrl:          product.thumbnailUrl,
      unitPriceWithVat:     displayPrice,
      unitPriceWithoutVat:  product.priceWithoutVat,
      vatRate:              product.vatRate,
      isWeightBased:        product.isWeightBased,
      unit:                 product.unit,
    }, 1)
    toast.success(`„${product.name}" přidáno do košíku`)
  }

  return (
    <Link
      href={`/produkt/${product.slug}`}
      className="group flex shrink-0 snap-start flex-col w-[44vw] sm:w-[160px] focus:outline-none"
    >
      {/* Foto */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-stone-100">
        {product.thumbnailUrl ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 44vw, 160px"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Štítek */}
        {badge && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        )}

        {/* + tlačítko */}
        <button
          onClick={handleAdd}
          disabled={!isAvailable || !hasPrice}
          aria-label="Přidat do košíku"
          className="
            absolute bottom-2 right-2
            flex h-9 w-9 items-center justify-center
            rounded-full bg-gold text-shop-bg text-xl font-bold
            shadow-md hover:scale-110 active:scale-95 transition-transform
            disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
          "
        >
          +
        </button>
      </div>

      {/* Info */}
      <div className="mt-2 px-0.5">
        {!hasPrice ? (
          <p className="text-sm font-semibold text-shop-muted">Cena na dotaz</p>
        ) : (
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[15px] font-bold text-shop-fg leading-tight">
              {prefix}{fmtKc(displayPrice)}
            </span>
            {activeSalePrice && (
              <span className="text-xs text-shop-muted line-through">{fmtKc(product.priceWithVat)}</span>
            )}
          </div>
        )}

        <p className="mt-0.5 text-xs font-medium text-shop-fg line-clamp-2 leading-snug">
          {product.name}
        </p>

        {weightLabel && (
          <p className="mt-0.5 text-[10px] text-shop-muted">{weightLabel}</p>
        )}
      </div>
    </Link>
  )
}
