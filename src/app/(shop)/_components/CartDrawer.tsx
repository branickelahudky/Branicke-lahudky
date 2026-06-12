'use client'

import { useCart } from '../_context/CartContext'
import { CartItemRow } from './cart/CartItemRow'
import { CartEmptyState } from './cart/CartEmptyState'
import { fmtKc } from './cart/fmtKc'

export function CartDrawer() {
  const { items, isOpen, closeCart, subtotalWithVat, totalQty } = useCart()

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeCart}
      />

      {/* Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-shop-surface shadow-2xl transition-transform duration-300 sm:w-[420px] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-shop-border px-5 py-4">
          <h2 className="text-lg font-bold text-shop-fg">
            Košík {totalQty > 0 && <span className="ml-1 text-gold">({totalQty})</span>}
          </h2>
          <button onClick={closeCart} className="rounded p-1 text-shop-muted hover:text-shop-fg transition" aria-label="Zavřít košík">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <CartEmptyState />
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <CartItemRow key={item.productId} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-shop-border px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-stone-300 text-sm">Mezisoučet (s DPH)</span>
              <span className="text-xl font-bold text-shop-fg">{fmtKc(subtotalWithVat)}</span>
            </div>
            <p className="text-xs text-shop-muted">Doprava se spočítá v pokladně.</p>
            <button disabled
              className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-shop-bg opacity-50 cursor-not-allowed">
              Pokladna — brzy k dispozici
            </button>
          </div>
        )}
      </div>
    </>
  )
}
