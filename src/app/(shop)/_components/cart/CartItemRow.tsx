'use client'

import Image from 'next/image'
import { useCart, cartItemKey, type CartItem } from '../../_context/CartContext'
import { fmtKc } from './fmtKc'

// Mini řádek položky košíku — používá flyout (CartFlyout).
// `highlight` = krátká vizuální odezva po přidání z karty.
export function CartItemRow({ item, highlight = false }: { item: CartItem; highlight?: boolean }) {
  const { updateQty, removeItem } = useCart()
  const key = cartItemKey(item)

  return (
    <div className={`flex gap-3 rounded-xl p-3 transition-colors duration-500 ${highlight ? 'bg-gold/10 ring-2 ring-gold' : 'bg-shop-card'}`}>
      {/* Foto */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {item.thumbnailUrl && (
          <Image src={item.thumbnailUrl} alt={item.name} fill
            className="object-contain p-1" sizes="64px" unoptimized />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-shop-fg">{item.name}</p>
        {item.variantName && (
          <p className="text-xs text-gold">{item.variantName}</p>
        )}
        <p className="mt-0.5 text-xs text-shop-muted">
          {fmtKc(item.unitPriceWithVat)}{item.isWeightBased ? ` / ${item.unit.toLowerCase()}` : ' / ks'}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          {/* Qty */}
          <div className="flex items-center gap-1">
            <button onClick={() => updateQty(key, item.qty - 1)}
              className="flex h-6 w-6 items-center justify-center rounded bg-shop-border text-sm text-shop-fg transition hover:bg-shop-muted/50"
              aria-label="Snížit množství">−</button>
            <span className="min-w-[1.5rem] text-center text-sm font-medium text-shop-fg">{item.qty}</span>
            <button onClick={() => updateQty(key, item.qty + 1)}
              className="flex h-6 w-6 items-center justify-center rounded bg-shop-border text-sm text-shop-fg transition hover:bg-shop-muted/50"
              aria-label="Zvýšit množství">+</button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-bold text-gold">{fmtKc(item.qty * item.unitPriceWithVat)}</span>
            <button onClick={() => removeItem(key)}
              className="p-1 text-shop-muted transition hover:text-red-400" aria-label="Odebrat">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
