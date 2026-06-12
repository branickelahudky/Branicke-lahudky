'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '../_context/CartContext'
import { CartItemRow } from './cart/CartItemRow'
import { CartEmptyState } from './cart/CartEmptyState'
import { fmtKc } from './cart/fmtKc'

// Sticky košík v pravém sloupci (desktop ≥ lg) — Rohlík styl.
// Sdílí CartContext s CartDrawer, takže přidání z karty „+" se ukáže okamžitě.
//
// showExpressPay: zatím vždy false. Expresní platba se zapne až po zavedení
// zákaznických účtů s adresou — viz TODO u tlačítka „Zaplatit ihned".
export function CartSidebar({ showExpressPay = false }: { showExpressPay?: boolean }) {
  const { items, subtotalWithVat, totalQty, lastAdded } = useCart()
  const empty = items.length === 0

  // Krátká vizuální odezva (flash) na naposledy přidanou položku
  const [flashId, setFlashId] = useState<string | null>(null)
  useEffect(() => {
    if (!lastAdded) return
    setFlashId(lastAdded.productId)
    const t = setTimeout(() => setFlashId(null), 900)
    return () => clearTimeout(t)
  }, [lastAdded])

  return (
    <aside className="sticky top-[112px] hidden h-[calc(100vh-112px)] w-[320px] shrink-0 self-start flex-col border-l border-stone-200 bg-white lg:flex">
      {/* Hlavička */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
        <h2 className="text-base font-bold text-shop-fg">
          Košík{totalQty > 0 && <span className="ml-1 text-gold">({totalQty})</span>}
        </h2>
      </div>

      {/* Položky (scroll) */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {empty ? (
          <CartEmptyState />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <CartItemRow key={item.productId} item={item} highlight={flashId === item.productId} />
            ))}
          </div>
        )}
      </div>

      {/* Patička */}
      <div className="border-t border-stone-200 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-shop-muted">Mezisoučet (s DPH)</span>
          <span className="text-lg font-bold text-shop-fg">{fmtKc(subtotalWithVat)}</span>
        </div>
        <p className="text-xs text-shop-muted">Doprava se spočítá v pokladně.</p>

        {/* Do pokladny — zlaté, plná šířka, disabled při prázdném košíku */}
        {empty ? (
          <button disabled
            className="w-full cursor-not-allowed rounded-xl bg-gold px-4 py-3 text-sm font-bold text-shop-bg opacity-40">
            Do pokladny
          </button>
        ) : (
          <Link href="/pokladna"
            className="block w-full rounded-xl bg-gold px-4 py-3 text-center text-sm font-bold text-shop-bg transition hover:bg-gold/90">
            Do pokladny
          </Link>
        )}

        {/* TODO „Zaplatit ihned" (expresní platba) — ZATÍM SE NERENDERUJE.
            Zapnout až po zavedení zákaznických účtů s dodací adresou.
            Podmínka renderu:
              showExpressPay === true && přihlášený zákazník && má vyplněnou dodací adresu
            Sekundární obrysové tlačítko povede na expresní pokladnu s předvyplněnou adresou. */}
        {showExpressPay && (
          <button
            className="w-full rounded-xl border border-gold px-4 py-3 text-sm font-bold text-gold transition hover:bg-gold/10">
            Zaplatit ihned
          </button>
        )}
      </div>
    </aside>
  )
}
