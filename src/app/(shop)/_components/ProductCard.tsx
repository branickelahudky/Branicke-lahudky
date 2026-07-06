'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart } from '../_context/CartContext'
import { flyToCart } from '../_lib/flyToCart'
import { activeSalePrice, salePercent, formatSaleEnd, pricePerKg, priceWithoutVat } from '@/lib/pricing'

export type ProductCardData = {
  id: string
  slug: string
  sku: string
  name: string
  priceWithVat: number
  priceWithoutVat: number
  vatRate: number
  salePriceWithVat: number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
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
  /** Produkt má aktivní varianty — „+" pak otevírá detail (nutí výběr varianty,
   *  aby cena i váha vždy odpovídaly konkrétní variantě) */
  hasVariants?: boolean
}

function fmtKc(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

/** 39,90 → „39⁹⁰ Kč" — halíře menším písmem v horním indexu (Rohlík styl) */
export function PriceWithCents({ value, prefix }: { value: number; prefix?: string }) {
  const whole = Math.floor(value)
  const cents = Math.round((value - whole) * 100)
  return (
    <>
      {prefix}
      {whole.toLocaleString('cs-CZ')}
      {cents > 0 && <sup className="text-[0.6em] font-bold">{String(cents).padStart(2, '0')}</sup>}
      {' Kč'}
    </>
  )
}

/** Popisek měrné jednotky váhového produktu („cena za kg" / „cena za 100 g") */
export function weightUnitLabel(unit: string): string | null {
  switch (unit) {
    case 'KG':     return 'cena za kg'
    case 'G_100':  return 'cena za 100 g'
    case 'L':      return 'cena za litr'
    case 'ML_100': return 'cena za 100 ml'
    default:       return null
  }
}

function fmtPerKg(n: number) {
  return `${n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Kč/kg`
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { addItem, openCart } = useCart()
  const router = useRouter()

  const isAvailable = product.stockStatus !== 'OUT_OF_STOCK'
  const hasPrice    = product.priceWithVat > 0

  // Sdílená logika platnosti — prošlá akce se nikde neukáže
  const salePrice = activeSalePrice(product)
  const displayPrice = salePrice ?? product.priceWithVat
  const prefix = product.isWeightBased ? 'od ' : ''

  // Červený štítek „Akce" jen při AKTIVNÍ slevě
  const badge = salePrice     ? { label: 'Akce',    cls: 'bg-red-500 text-white' }
    : product.isNew           ? { label: 'Novinka', cls: 'bg-gold text-shop-bg'  }
    : product.isFeatured      ? { label: 'Tip',     cls: 'bg-blue-600 text-white' }
    : null

  const weightLabel = product.weightGrams
    ? product.weightGrams >= 1000
      ? `${(product.weightGrams / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg`
      : `${product.weightGrams} g`
    : null

  // Spodní řádek: vlevo gramáž (u váhových „cena za kg"), vpravo Kč/kg
  const unitLeft = product.isWeightBased ? weightUnitLabel(product.unit) : weightLabel
  const perKg = !product.isWeightBased && hasPrice ? pricePerKg(displayPrice, product.weightGrams) : null

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    // Produkt s variantami nelze přidat naslepo — otevřeme detail,
    // kde si zákazník variantu vybere (cena a váha pak vždy sedí)
    if (product.hasVariants) {
      router.push(`/produkt/${product.slug}`)
      return
    }

    if (!isAvailable || !hasPrice) return
    const origin = e.currentTarget as HTMLElement
    addItem({
      productId: product.id,
      variantId: null,
      variantName: null,
      weightGrams: product.weightGrams,
      slug:      product.slug,
      sku:       product.sku,
      name:      product.name,
      thumbnailUrl:          product.thumbnailUrl,
      unitPriceWithVat:     displayPrice,
      unitPriceWithoutVat:  salePrice !== null
        ? priceWithoutVat(salePrice, product.vatRate)
        : product.priceWithoutVat,
      vatRate:              product.vatRate,
      isWeightBased:        product.isWeightBased,
      unit:                 product.unit,
    }, 1)
    // Klik → fotka letí do košíku → po doletu se vysune flyout (bez toastu)
    flyToCart(origin, product.thumbnailUrl, () => openCart('auto'))
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
          data-cart-add
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
        {/* Cenový řádek */}
        {!hasPrice ? (
          <p className="text-sm font-semibold text-shop-muted">Cena na dotaz</p>
        ) : salePrice ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-md bg-[#FFE14D] px-1.5 py-0.5 text-[15px] font-bold text-stone-900 leading-tight">
              <PriceWithCents value={salePrice} prefix={prefix} />
            </span>
            <span className="text-xs text-shop-muted line-through">{fmtKc(product.priceWithVat)}</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[15px] font-bold text-shop-fg leading-tight">
              {prefix}{fmtKc(displayPrice)}
            </span>
          </div>
        )}

        {/* Štítek slevy s platností */}
        {salePrice && (
          <p className="mt-1">
            <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 leading-none">
              −{salePercent(product.priceWithVat, salePrice)} %
              {product.saleEndsAt && (
                <span className="font-medium"> do {formatSaleEnd(product.saleEndsAt)}</span>
              )}
            </span>
          </p>
        )}

        {/* Název */}
        <p className="mt-0.5 text-xs font-medium text-shop-fg line-clamp-2 leading-snug">
          {product.name}
        </p>

        {/* Spodní řádek: dostupnost + gramáž vlevo, Kč/kg vpravo */}
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-shop-muted">
          <span className="flex min-w-0 items-center gap-1">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}
              aria-hidden="true"
            />
            <span className="truncate">
              {isAvailable ? 'Skladem' : 'Není skladem'}
              {unitLeft && ` · ${unitLeft}`}
            </span>
          </span>
          {perKg !== null && <span className="shrink-0">{fmtPerKg(perKg)}</span>}
        </div>
      </div>
    </Link>
  )
}
