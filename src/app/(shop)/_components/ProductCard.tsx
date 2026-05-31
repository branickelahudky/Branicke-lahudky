'use client'

import { useState } from 'react'
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
  isWeightBased: boolean
  unit: string
  weightGrams: number | null
  isNew: boolean
  isOnSale: boolean
  isFeatured: boolean
  stockQuantity: number
  stockStatus: string
  trackStock: boolean
  thumbnailUrl: string | null
}

function fmtKc(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function StockBadge({ trackStock, stockStatus, stockQuantity }: {
  trackStock: boolean; stockStatus: string; stockQuantity: number
}) {
  if (!trackStock || stockStatus === 'IN_STOCK') {
    return <span className="text-[10px] font-medium text-green-600">● Skladem</span>
  }
  if (stockStatus === 'LOW_STOCK') {
    return <span className="text-[10px] font-medium text-amber-500">● Skladem ({stockQuantity} ks)</span>
  }
  if (stockStatus === 'OUT_OF_STOCK') {
    return <span className="text-[10px] font-medium text-red-500">● Není skladem</span>
  }
  if (stockStatus === 'ON_REQUEST') {
    return <span className="text-[10px] font-medium text-stone-400">● Na dotaz</span>
  }
  return <span className="text-[10px] font-medium text-stone-400">● Dočasně nedostupné</span>
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const cart = useCart()
  const [qty, setQty] = useState(1)

  const isAvailable = product.stockStatus !== 'OUT_OF_STOCK'
  const hasPrice = product.priceWithVat > 0
  const prefix = product.isWeightBased ? 'od ' : ''

  const badge = product.isOnSale  ? { label: 'Akce',    cls: 'bg-red-500 text-white' }
    : product.isNew               ? { label: 'Novinka', cls: 'bg-gold text-shop-bg' }
    : product.isFeatured          ? { label: 'Tip',     cls: 'bg-blue-600 text-white' }
    : null

  function handleAddToCart() {
    cart.addItem({
      productId: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      thumbnailUrl: product.thumbnailUrl,
      unitPriceWithVat: product.priceWithVat,
      unitPriceWithoutVat: product.priceWithoutVat,
      vatRate: product.vatRate,
      isWeightBased: product.isWeightBased,
      unit: product.unit,
    }, qty)
    toast.success(`„${product.name}" přidáno do košíku`)
    setQty(1)
  }

  return (
    <div className="group relative flex shrink-0 snap-start flex-col w-[47vw] sm:w-48 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">

      {/* Fotka */}
      <div className="relative aspect-square bg-stone-100 overflow-hidden">
        {product.thumbnailUrl ? (
          <Image src={product.thumbnailUrl} alt={product.name} fill
            className="object-contain object-center p-1"
            sizes="(max-width: 640px) 47vw, 192px" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Štítek vlevo nahoře */}
        {badge && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        )}

        {/* SKU badge vpravo nahoře */}
        {product.sku && (
          <span className="absolute right-2 top-2 rounded bg-black/30 px-1.5 py-0.5 text-[9px] text-white/80">
            {product.sku}
          </span>
        )}
      </div>

      {/* Tělo */}
      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="line-clamp-2 text-xs font-semibold text-stone-900 leading-snug mb-1">
          {product.name}
        </h3>

        <StockBadge
          trackStock={product.trackStock}
          stockStatus={product.stockStatus}
          stockQuantity={product.stockQuantity}
        />

        {/* Ceny */}
        <div className="mt-1.5">
          {!hasPrice ? (
            <p className="text-sm font-bold text-stone-500">Cena na dotaz</p>
          ) : (
            <>
              <p className="text-[10px] text-stone-400">
                {prefix}{fmtKc(product.priceWithoutVat)} bez DPH
              </p>
              <p className="text-sm font-bold text-stone-900 leading-tight">
                {prefix}{fmtKc(product.priceWithVat)}
              </p>
            </>
          )}
        </div>

        {/* Akce — spodek karty */}
        <div className="mt-2 space-y-1.5">
          {/* Počítadlo + Detail */}
          <div className="flex items-center gap-1.5">
            {/* Qty counter */}
            <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 overflow-hidden">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center text-stone-500 hover:bg-stone-100 transition text-sm"
              >−</button>
              <span className="min-w-[1.5rem] text-center text-xs font-semibold text-stone-900">{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="flex h-7 w-7 items-center justify-center text-stone-500 hover:bg-stone-100 transition text-sm"
              >+</button>
            </div>

            <Link href={`/produkty/${product.slug}`}
              className="flex-1 rounded-lg border border-stone-200 py-1 text-center text-[10px] font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition">
              Detail
            </Link>
          </div>

          {/* Do košíku */}
          <button
            onClick={handleAddToCart}
            disabled={!isAvailable || !hasPrice}
            className="w-full rounded-lg bg-gold py-1.5 text-xs font-bold text-shop-bg hover:bg-gold/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🛒 Do košíku
          </button>
        </div>
      </div>
    </div>
  )
}
