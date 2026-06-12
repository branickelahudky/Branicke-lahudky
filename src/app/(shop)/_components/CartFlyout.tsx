'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '../_context/CartContext'
import { CartItemRow } from './cart/CartItemRow'
import { CartEmptyState } from './cart/CartEmptyState'
import { fmtKc } from './cart/fmtKc'

// Vysouvací košík zprava (desktop i mobil). Sjednocuje dřívější CartDrawer.
// Auto-otevření po přidání (openMode 'auto') se po 2,5 s samo zasune, pokud
// na panelu není kurzor/focus. Ruční otevření z hlavičky ('manual') zůstává.
const AUTO_CLOSE_MS = 2500
const FLASH_MS = 1800

export function CartFlyout() {
  const { items, isOpen, openMode, closeCart, subtotalWithVat, totalQty, lastAdded } = useCart()
  const panelRef = useRef<HTMLDivElement>(null)
  const empty = items.length === 0

  // Pozastavení auto-zavření při hoveru/focusu nad panelem
  const [active, setActive] = useState(false)

  // Flash zvýraznění naposledy přidané položky
  const [flashId, setFlashId] = useState<string | null>(null)
  useEffect(() => {
    if (!lastAdded) return
    setFlashId(lastAdded.productId)
    const t = window.setTimeout(() => setFlashId(null), FLASH_MS)
    return () => window.clearTimeout(t)
  }, [lastAdded])

  // Auto-zavření (jen režim 'auto', když není pozastaveno). Reset při novém
  // přidání — díky závislosti na lastAdded?.nonce.
  useEffect(() => {
    if (!isOpen || openMode !== 'auto' || active) return
    const t = window.setTimeout(closeCart, AUTO_CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [isOpen, openMode, active, lastAdded?.nonce, closeCart])

  // Esc zavírá
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCart() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeCart])

  // Klik mimo panel zavírá (ikona košíku v hlavičce je vyjmuta — ta si řídí otevření sama)
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (panelRef.current?.contains(target)) return
      if (target.closest('#cart-icon')) return
      // přidání z karty/detailu nezavírá flyout — jen resetuje timer + highlight
      if (target.closest('[data-cart-add]')) return
      closeCart()
    }
    // až po aktuálním ticku, ať klik, který panel otevřel, hned nezavře
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('mousedown', onDown) }
  }, [isOpen, closeCart])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Košík"
      aria-hidden={!isOpen}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocusCapture={() => setActive(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setActive(false) }}
      className={`fixed inset-y-0 right-0 z-50 flex w-[92vw] flex-col rounded-l-2xl border-l border-stone-200 bg-white shadow-xl transition-transform duration-[250ms] ease-out sm:w-[340px] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Hlavička */}
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <h2 className="text-lg font-bold text-shop-fg">
          Košík {totalQty > 0 && <span className="ml-1 text-gold">({totalQty})</span>}
        </h2>
        <button onClick={closeCart} className="rounded p-1 text-shop-muted transition hover:text-shop-fg" aria-label="Zavřít košík">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Položky */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {empty ? (
          <CartEmptyState />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <CartItemRow key={item.productId} item={item} highlight={flashId === item.productId} />
            ))}
          </div>
        )}
      </div>

      {/* Patička */}
      {!empty && (
        <div className="space-y-3 border-t border-stone-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-shop-muted">Mezisoučet (s DPH)</span>
            <span className="text-xl font-bold text-shop-fg">{fmtKc(subtotalWithVat)}</span>
          </div>
          <p className="text-xs text-shop-muted">Doprava se spočítá v pokladně.</p>
          <Link href="/pokladna"
            className="block w-full rounded-xl bg-gold px-4 py-3 text-center text-sm font-bold text-shop-bg transition hover:bg-gold/90">
            Do pokladny
          </Link>
        </div>
      )}
    </div>
  )
}
