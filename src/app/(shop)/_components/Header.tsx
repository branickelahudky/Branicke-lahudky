'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '../_context/CartContext'

export type NavItem = { id: string; label: string; href: string; openNewTab: boolean }

interface Props {
  logoUrl: string | null
  logoAlt: string | null
  navItems: NavItem[]
}

export function Header({ logoUrl, logoAlt, navItems }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { totalQty, openCart } = useCart()

  return (
    <header className="sticky top-0 z-50 bg-shop-bg border-b border-shop-border">
      <div className="mx-auto max-w-7xl px-4">
        {/* Hlavní řada */}
        <div className="flex h-16 items-center gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center">
            {logoUrl ? (
              <div className="relative h-10 w-32">
                <Image src={logoUrl} alt={logoAlt ?? 'Branické lahůdkářství'}
                  fill className="object-contain object-left" unoptimized />
              </div>
            ) : (
              <span className="text-lg font-bold text-gold leading-tight">
                Branické<br className="hidden" /> lahůdkářství
              </span>
            )}
          </Link>

          {/* Search — desktop */}
          <div className="hidden flex-1 md:block">
            <div className="relative mx-auto max-w-lg">
              <input
                type="search"
                placeholder="Hledat produkty…"
                className="w-full rounded-full bg-shop-surface border border-shop-border px-5 py-2 text-sm text-shop-fg placeholder-shop-muted focus:outline-none focus:border-gold/50"
                readOnly
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-shop-muted hover:text-gold">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Search icon — mobile */}
            <button className="md:hidden text-shop-muted hover:text-shop-fg p-1">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Košík */}
            <button
              onClick={openCart}
              className="relative flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-sm font-medium text-shop-bg hover:bg-gold/90 transition"
              aria-label="Košík"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{totalQty}</span>
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

        {/* Navigation — desktop */}
        {navItems.length > 0 && (
          <nav className="hidden md:flex h-10 items-center gap-1 overflow-x-auto">
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

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-shop-border bg-shop-surface px-4 py-3">
          {/* Mobile search */}
          <div className="relative mb-3">
            <input
              type="search"
              placeholder="Hledat produkty…"
              className="w-full rounded-full bg-shop-card border border-shop-border px-4 py-2 text-sm text-shop-fg placeholder-shop-muted focus:outline-none"
              readOnly
            />
          </div>
          {/* Mobile nav */}
          <nav className="flex flex-col gap-0.5">
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
        </div>
      )}
    </header>
  )
}
