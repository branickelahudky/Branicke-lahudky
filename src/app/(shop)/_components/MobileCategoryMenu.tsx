'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MegaCategory } from './CategoryNavBar'

export function MobileCategoryMenu({
  categories,
  onNavigate,
}: {
  categories: MegaCategory[]
  onNavigate: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (categories.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-shop-muted">
        Kategorie
      </p>
      {categories.map((c) => (
        <div key={c.id}>
          <div className="flex items-center">
            <Link
              href={`/kategorie/${c.slug}`}
              onClick={onNavigate}
              className="flex-1 rounded px-3 py-2 text-sm font-medium text-stone-200 hover:text-gold transition"
            >
              {c.name}
            </Link>
            {c.children.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => (e === c.id ? null : c.id))}
                className="px-3 py-2 text-shop-muted hover:text-gold"
                aria-label={`Rozbalit ${c.name}`}
                aria-expanded={expanded === c.id}
              >
                <svg
                  className={`h-4 w-4 transition-transform ${expanded === c.id ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          {expanded === c.id && c.children.length > 0 && (
            <div className="ml-3 mb-1 flex flex-col gap-0.5 border-l border-shop-border pl-2">
              {c.children.map((s) => (
                <Link
                  key={s.id}
                  href={`/kategorie/${s.slug}`}
                  onClick={onNavigate}
                  className="flex items-center justify-between rounded px-3 py-1.5 text-sm text-stone-300 hover:text-gold transition"
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-shop-muted">{s.productCount}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
