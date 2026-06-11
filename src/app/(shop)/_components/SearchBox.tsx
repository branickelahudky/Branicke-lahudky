'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type SearchResult = {
  id: string
  slug: string
  sku: string
  name: string
  thumbnailUrl: string | null
  priceWithVat: number
  salePriceWithVat: number | null
  isOnSale: boolean
  isWeightBased: boolean
}

function fmtKc(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function priceLabel(r: SearchResult) {
  if (r.priceWithVat <= 0) return 'Cena na dotaz'
  const active = r.isOnSale && r.salePriceWithVat && r.salePriceWithVat > 0 ? r.salePriceWithVat : r.priceWithVat
  return `${r.isWeightBased ? 'od ' : ''}${fmtKc(active)}`
}

export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Debounce + fetch
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        const data = await res.json()
        setResults(data.results ?? [])
        setOpen(true)
      } catch {
        /* aborted nebo chyba sítě — ignoruj */
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  // Esc + klik mimo
  useEffect(() => {
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
  }, [])

  function submit() {
    const term = q.trim()
    if (term.length < 1) return
    setOpen(false)
    onNavigate?.()
    router.push(`/hledat?q=${encodeURIComponent(term)}`)
  }

  function handleResultClick() {
    setOpen(false)
    onNavigate?.()
  }

  const showDropdown = open && q.trim().length >= 2 && !loading

  return (
    <div ref={ref} className="relative w-full">
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true) }}
          placeholder="Hledat produkty…"
          className="w-full rounded-full bg-shop-surface border border-shop-border px-5 py-2 pr-10 text-sm text-shop-fg placeholder-shop-muted focus:outline-none focus:border-gold/50"
        />
        <button type="submit" aria-label="Hledat"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-shop-muted hover:text-gold">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-shop-border bg-shop-surface shadow-2xl">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-shop-muted">
              Nic jsme nenašli — zkus jiný výraz.
            </p>
          ) : (
            <>
              <ul className="max-h-[60vh] overflow-y-auto py-1">
                {results.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/produkt/${r.slug}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-shop-card transition"
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                        {r.thumbnailUrl ? (
                          <Image src={r.thumbnailUrl} alt={r.name} fill className="object-cover" sizes="44px" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <svg className="h-5 w-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1 text-sm text-shop-fg line-clamp-2 leading-snug">{r.name}</span>
                      <span className="shrink-0 text-sm font-semibold text-gold">{priceLabel(r)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={submit}
                className="block w-full border-t border-shop-border px-4 py-2.5 text-center text-sm font-medium text-gold hover:bg-shop-card transition"
              >
                Zobrazit všechny výsledky
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
