'use client'

import Image from 'next/image'
import { useCart } from '../_context/CartContext'

function fmtKc(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQty, subtotalWithVat, totalQty } = useCart()

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
          <h2 className="text-lg font-bold text-white">
            Košík {totalQty > 0 && <span className="ml-1 text-gold">({totalQty})</span>}
          </h2>
          <button onClick={closeCart} className="rounded p-1 text-shop-muted hover:text-white transition" aria-label="Zavřít košík">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <p className="text-4xl mb-4">🛒</p>
              <p className="font-semibold text-stone-300">Košík je prázdný</p>
              <p className="mt-1 text-sm text-shop-muted">Přidejte produkty z nabídky</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.productId} className="flex gap-3 rounded-xl bg-shop-card p-3">
                  {/* Foto */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {item.thumbnailUrl && (
                      <Image src={item.thumbnailUrl} alt={item.name} fill
                        className="object-contain p-1" sizes="64px" unoptimized />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-white leading-snug">{item.name}</p>
                    <p className="mt-0.5 text-xs text-shop-muted">
                      {fmtKc(item.unitPriceWithVat)}{item.isWeightBased ? ` / ${item.unit.toLowerCase()}` : ' / ks'}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      {/* Qty */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.productId, item.qty - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-shop-border text-sm text-white hover:bg-shop-muted/50 transition">−</button>
                        <span className="min-w-[1.5rem] text-center text-sm font-medium text-white">{item.qty}</span>
                        <button onClick={() => updateQty(item.productId, item.qty + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-shop-border text-sm text-white hover:bg-shop-muted/50 transition">+</button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-gold">{fmtKc(item.qty * item.unitPriceWithVat)}</span>
                        <button onClick={() => removeItem(item.productId)}
                          className="p-1 text-shop-muted hover:text-red-400 transition" aria-label="Odebrat">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-shop-border px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-stone-300 text-sm">Mezisoučet (s DPH)</span>
              <span className="text-xl font-bold text-white">{fmtKc(subtotalWithVat)}</span>
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
