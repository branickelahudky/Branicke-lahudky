'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { formatCZK } from '@/lib/pricing'
import { addRelatedProduct, removeRelatedProduct, searchProducts } from './actions'
import type { SerializedRelatedProduct } from './ProductDetailClient'

interface Props {
  productId: string
  related: SerializedRelatedProduct[]
}

type SearchResult = {
  id: string
  name: string
  sku: string
  priceWithVat: number
  thumbnailUrl: string | null
}

const MAX_RELATED = 10

// ── Search modal ──────────────────────────────────────────────────

function SearchModal({
  productId,
  excludeIds,
  onAdd,
  onClose,
}: {
  productId: string
  excludeIds: string[]
  onAdd: (id: string, name: string) => Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await searchProducts(query, [productId, ...excludeIds])
        setResults(res)
      } catch {
        // ignore
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, productId, excludeIds])

  async function handleAdd(result: SearchResult) {
    setAdding(result.id)
    try {
      await onAdd(result.id, result.name)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">Přidat související produkt</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>
        <div className="px-5 pt-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat podle názvu nebo SKU…"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto px-5 py-3">
          {isSearching && (
            <p className="py-4 text-center text-sm text-stone-400">Hledám…</p>
          )}
          {!isSearching && query.trim().length >= 2 && results.length === 0 && (
            <p className="py-4 text-center text-sm text-stone-400">Nic nenalezeno</p>
          )}
          {!isSearching && query.trim().length < 2 && (
            <p className="py-4 text-center text-sm text-stone-400">Zadejte alespoň 2 znaky</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleAdd(r)}
              disabled={adding === r.id}
              className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-stone-50 disabled:opacity-40"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
                {r.thumbnailUrl && (
                  <Image src={r.thumbnailUrl} alt="" fill className="object-cover" sizes="40px" unoptimized />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{r.name}</p>
                <p className="text-xs text-stone-400">SKU {r.sku} · {formatCZK(r.priceWithVat)}</p>
              </div>
              <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                {adding === r.id ? '…' : 'Přidat'}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-stone-200 px-5 py-3 text-right">
          <button onClick={onClose}
            className="rounded border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
            Zavřít
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export function RelatedTab({ productId, related: initialRelated }: Props) {
  const [related, setRelated] = useState<SerializedRelatedProduct[]>(initialRelated)
  const [showSearch, setShowSearch] = useState(false)
  const [, startTransition] = useTransition()

  const excludeIds = related.map((r) => r.id)
  const atLimit = related.length >= MAX_RELATED

  async function handleAdd(relatedId: string, name: string) {
    await addRelatedProduct(productId, relatedId)
    toast.success(`„${name}" přidán do souvisejících`)
    startTransition(() => { window.location.reload() })
  }

  async function handleRemove(r: SerializedRelatedProduct) {
    try {
      await removeRelatedProduct(productId, r.id)
      setRelated((prev) => prev.filter((x) => x.id !== r.id))
      toast.success('Odebráno ze souvisejících')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-700">Související produkty</h3>
          <p className="mt-0.5 text-xs text-stone-400">
            Produkty, které doporučujete k tomuto. Zobrazí se zákazníkům jako „Mohlo by se vám líbit" (max {MAX_RELATED}).
          </p>
        </div>
        <button
          onClick={() => setShowSearch(true)}
          disabled={atLimit}
          className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Přidat
        </button>
      </div>

      {related.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-200 py-12 text-center">
          <div className="mb-3 text-4xl text-stone-200">🔗</div>
          <p className="font-medium text-stone-500">Žádné související produkty</p>
          <p className="mt-1 text-sm text-stone-400">Přidejte produkty, které zákazníci obvykle kupují spolu.</p>
          <button
            onClick={() => setShowSearch(true)}
            className="mt-4 rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Přidat první
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((r) => (
            <div key={r.id} className="group relative flex gap-3 rounded-lg border border-stone-200 bg-white p-3 hover:border-stone-300">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
                {r.thumbnailUrl && (
                  <Image src={r.thumbnailUrl} alt="" fill className="object-cover" sizes="56px" unoptimized />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{r.name}</p>
                <p className="text-xs text-stone-500">{formatCZK(r.priceWithVat)}</p>
              </div>
              <button
                onClick={() => handleRemove(r)}
                className="absolute right-2 top-2 rounded p-1 text-stone-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                title="Odebrat"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-amber-600">Dosažen limit {MAX_RELATED} souvisejících produktů.</p>
      )}

      {showSearch && (
        <SearchModal
          productId={productId}
          excludeIds={excludeIds}
          onAdd={handleAdd}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}
