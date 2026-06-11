'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

export type MegaCategory = {
  id: string
  name: string
  slug: string
  productCount: number
  children: { id: string; name: string; slug: string; productCount: number }[]
}

function GridIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

export function CategoryMegaMenu({ categories }: { categories: MegaCategory[] }) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(categories[0]?.id ?? null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (categories.length === 0) return null

  const active = categories.find((c) => c.id === activeId) ?? categories[0]

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-shop-bg hover:bg-gold/90 transition"
      >
        <GridIcon />
        <span>Kategorie</span>
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-[700px] max-w-[92vw] overflow-hidden rounded-2xl border border-shop-border bg-shop-surface shadow-2xl">
          {/* Kořenové kategorie */}
          <ul className="max-h-[72vh] w-56 shrink-0 overflow-y-auto border-r border-shop-border py-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/kategorie/${c.slug}`}
                  onMouseEnter={() => setActiveId(c.id)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between gap-2 px-4 py-2 text-sm transition ${
                    active?.id === c.id
                      ? 'bg-shop-card font-semibold text-gold'
                      : 'text-stone-300 hover:text-gold'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-shop-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Podkategorie aktivní kořenové */}
          <div className="max-h-[72vh] flex-1 overflow-y-auto p-5">
            {active && (
              <>
                <Link
                  href={`/kategorie/${active.slug}`}
                  onClick={() => setOpen(false)}
                  className="mb-4 inline-flex items-baseline gap-2 text-base font-bold text-shop-fg hover:text-gold transition"
                >
                  {active.name}
                  <span className="text-xs font-normal text-shop-muted">{active.productCount} produktů</span>
                </Link>
                {active.children.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {active.children.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/kategorie/${s.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-stone-300 hover:bg-shop-card hover:text-gold transition"
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="shrink-0 text-xs text-shop-muted">{s.productCount}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-shop-muted">
                    Tato kategorie nemá podkategorie — klikni na název pro zobrazení produktů.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
