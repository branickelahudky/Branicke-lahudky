'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '../_context/CartContext'
import { CategoryMegaMenu, type MegaCategory } from './CategoryMegaMenu'
import { MobileCategoryMenu } from './MobileCategoryMenu'
import { SearchBox } from './SearchBox'
import { logoutAction } from '../ucet/actions'

export type NavItem = { id: string; label: string; href: string; openNewTab: boolean }

interface Props {
  logoUrl: string | null
  logoAlt: string | null
  navItems: NavItem[]
  categories: MegaCategory[]
  /** Křestní jméno přihlášeného zákazníka, null = nepřihlášen */
  customerName: string | null
}

// Ikona osoby: nepřihlášený → odkaz na přihlášení, přihlášený → menu účtu
function AccountMenu({ customerName }: { customerName: string | null }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const icon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )

  if (!customerName) {
    return (
      <Link href="/ucet/prihlaseni" aria-label="Přihlášení"
        className="p-1 text-shop-muted transition hover:text-gold">
        {icon}
      </Link>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Můj účet"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full p-1 text-gold transition hover:text-gold/80"
      >
        {icon}
        <span className="hidden max-w-[7rem] truncate text-sm font-medium lg:inline">{customerName}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <Link href="/ucet" onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-shop-fg transition hover:bg-gold/10">
            Můj účet
          </Link>
          <Link href="/ucet/objednavky" onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-shop-fg transition hover:bg-gold/10">
            Objednávky
          </Link>
          <form action={logoutAction}>
            <button type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-shop-muted transition hover:bg-red-50 hover:text-red-600">
              Odhlásit se
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export function Header({ logoUrl, logoAlt, navItems, categories, customerName }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { totalQty, openCart } = useCart()

  return (
    <header className="sticky top-0 z-50 bg-shop-bg border-b border-shop-border">
      <div className="mx-auto max-w-7xl px-4">
        {/* Hlavní řada */}
        <div className="flex h-16 items-center gap-4">
          {/* Logo — tmavý kulatý podklad (logo má vlastní černé pozadí,
              na bílé hlavičce by jinak působilo jako černý hranatý blok) */}
          <Link href="/" className="shrink-0 flex items-center">
            {logoUrl ? (
              <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-[#0a0a0a]">
                <Image src={logoUrl} alt={logoAlt ?? 'Markes lahůdkářství'}
                  fill className="object-contain" sizes="44px" unoptimized />
              </div>
            ) : (
              <span className="text-lg font-bold text-gold leading-tight">
                Markes<br className="hidden" /> lahůdkářství
              </span>
            )}
          </Link>

          {/* Search — desktop */}
          <div className="hidden flex-1 md:block">
            <div className="mx-auto max-w-lg">
              <SearchBox />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Search icon — mobile */}
            <button
              className="md:hidden text-shop-muted hover:text-shop-fg p-1"
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Hledat"
              aria-expanded={searchOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Účet */}
            <AccountMenu customerName={customerName} />

            {/* Košík — #cart-icon je cíl animace „letící produkt" (viz flyToCart) */}
            <button
              id="cart-icon"
              onClick={() => openCart()}
              className="relative flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-sm font-medium text-shop-bg hover:bg-gold/90 transition"
              aria-label="Košík"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span id="cart-badge" className="inline-block">{totalQty}</span>
            </button>

            {/* Hamburger — mobile */}
            <button
              className="md:hidden p-1 text-shop-muted hover:text-shop-fg"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              {menuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search — přes celou šířku */}
        {searchOpen && (
          <div className="md:hidden pb-3">
            <SearchBox onNavigate={() => setSearchOpen(false)} />
          </div>
        )}

        {/* Druhá řada — desktop: Kategorie + nav */}
        <div className="hidden md:flex h-12 items-center gap-2">
          <CategoryMegaMenu categories={categories} />
          {navItems.length > 0 && (
            <nav className="flex items-center gap-1 overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  target={item.openNewTab ? '_blank' : undefined}
                  className="whitespace-nowrap rounded px-3 py-1 text-sm text-stone-300 hover:text-shop-fg hover:bg-shop-surface transition"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-shop-border bg-shop-surface px-4 py-3">
          {/* Kategorie — accordion */}
          <MobileCategoryMenu categories={categories} onNavigate={() => setMenuOpen(false)} />

          {/* Ostatní nav */}
          {navItems.length > 0 && (
            <nav className="mt-3 flex flex-col gap-0.5 border-t border-shop-border pt-3">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded px-3 py-2 text-sm text-stone-300 hover:text-shop-fg hover:bg-shop-card transition"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      )}
    </header>
  )
}
