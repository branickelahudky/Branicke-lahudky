'use client'

// Tmavá navigační lišta s kořenovými kategoriemi (jako starý Shoptet web).
// Dropdown podkategorií s hover-intentem: žádná mezera mezi lištou a panelem
// (panel navazuje na top-full) a zavírání se zpožděním ~200 ms, takže přejezd
// myši z lišty do panelu menu nezavře.
//
// Lišta může horizontálně scrollovat (overflow-x), což by ořezalo absolutně
// pozicovaný dropdown uvnitř — panel se proto vykresluje MIMO scrollující <ul>,
// na změřené pozici spouštěče.

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import type { NavItem } from './Header'

export type MegaCategory = {
  id: string
  name: string
  slug: string
  productCount: number
  children: { id: string; name: string; slug: string; productCount: number }[]
}

const CLOSE_DELAY_MS = 200
const PANEL_WIDTH = 280

export function CategoryNavBar({
  categories,
  navItems,
}: {
  categories: MegaCategory[]
  navItems: NavItem[]
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [panelLeft, setPanelLeft] = useState(0)
  const navRef = useRef<HTMLElement>(null)
  const closeTimer = useRef<number | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // Hover intent — zavření až po prodlevě, přejezd do panelu ho zruší
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpenId(null), CLOSE_DELAY_MS)
  }, [cancelClose])

  const openFor = useCallback((id: string, trigger: HTMLElement) => {
    cancelClose()
    const navRect = navRef.current?.getBoundingClientRect()
    if (navRect) {
      const triggerRect = trigger.getBoundingClientRect()
      const raw = triggerRect.left - navRect.left
      // nepustit panel za pravý okraj lišty
      setPanelLeft(Math.max(0, Math.min(raw, navRect.width - PANEL_WIDTH - 8)))
    }
    setOpenId(id)
  }, [cancelClose])

  // Esc + klik mimo zavírá
  useEffect(() => {
    if (!openId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null)
    }
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [openId])

  // uklidit timer při odmountování
  useEffect(() => () => cancelClose(), [cancelClose])

  if (categories.length === 0 && navItems.length === 0) return null

  const openCategory = categories.find((c) => c.id === openId) ?? null

  return (
    <nav ref={navRef} aria-label="Kategorie" className="relative hidden bg-[#0a0a0a] md:block">
      <div className="mx-auto max-w-7xl px-4">
        <ul className="flex items-stretch overflow-x-auto whitespace-nowrap text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const hasChildren = c.children.length > 0
            const isOpen = openId === c.id
            return (
              <li key={c.id} className="shrink-0">
                <Link
                  href={`/kategorie/${c.slug}`}
                  aria-expanded={hasChildren ? isOpen : undefined}
                  aria-haspopup={hasChildren ? 'true' : undefined}
                  onMouseEnter={(e) => {
                    if (hasChildren) openFor(c.id, e.currentTarget)
                    else { cancelClose(); setOpenId(null) }
                  }}
                  onFocus={(e) => {
                    if (hasChildren) openFor(c.id, e.currentTarget)
                  }}
                  onMouseLeave={scheduleClose}
                  onClick={() => setOpenId(null)}
                  className={`flex h-11 items-center gap-1 px-3 font-medium transition lg:px-3.5 ${
                    isOpen ? 'text-gold' : 'text-white hover:text-gold'
                  }`}
                >
                  {c.name}
                  {hasChildren && (
                    <svg
                      className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180 text-gold' : 'text-stone-400'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </Link>
              </li>
            )
          })}

          {/* Položky z admin menu (Obchodní podmínky, Kontakt…) */}
          {navItems.map((item) => (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                target={item.openNewTab ? '_blank' : undefined}
                onMouseEnter={() => { cancelClose(); setOpenId(null) }}
                className="flex h-11 items-center px-3 text-stone-300 transition hover:text-gold lg:px-3.5"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Dropdown podkategorií — sourozenec scrollující ul, nic ho neořeže.
          Navazuje přímo na spodní hranu lišty (top-full, bez mezery). */}
      {openCategory && openCategory.children.length > 0 && (
        <div
          className="absolute top-full z-50"
          style={{ left: panelLeft, width: PANEL_WIDTH }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="overflow-hidden rounded-b-xl rounded-tr-xl border border-stone-200 bg-white shadow-xl">
            <Link
              href={`/kategorie/${openCategory.slug}`}
              onClick={() => setOpenId(null)}
              className="flex items-baseline justify-between gap-2 border-b border-stone-100 px-4 py-2.5 text-sm font-bold text-shop-fg transition hover:text-gold"
            >
              Vše z {openCategory.name}
              <span className="text-xs font-normal text-shop-muted">
                {openCategory.productCount} produktů
              </span>
            </Link>
            <ul className="max-h-[60vh] overflow-y-auto py-1.5">
              {openCategory.children.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/kategorie/${s.slug}`}
                    onClick={() => setOpenId(null)}
                    className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-shop-fg transition hover:bg-gold/10 hover:text-gold"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 text-xs text-shop-muted">{s.productCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </nav>
  )
}
