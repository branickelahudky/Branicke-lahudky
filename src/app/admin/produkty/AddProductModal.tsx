'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createProduct } from './actions'
import type { SerializedCategory } from './ProductsClient'

interface Props {
  categories: SerializedCategory[]
  onClose: () => void
}

export function AddProductModal({ categories, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [vatRate, setVatRate] = useState('12')
  const [catOpen, setCatOpen] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Popisek vybrané kategorie
  const selectedLabel = (() => {
    if (!categoryId) return null
    for (const cat of categories) {
      if (cat.id === categoryId) return cat.name
      const child = cat.children.find((c) => c.id === categoryId)
      if (child) return `${cat.name} / ${child.name}`
    }
    return null
  })()

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Název je povinný.'
    if (!categoryId) e.categoryId = 'Kategorie je povinná.'
    if (price !== '' && parseFloat(price) < 0) e.price = 'Cena musí být ≥ 0.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    startTransition(async () => {
      try {
        const result = await createProduct({
          name: name.trim(),
          categoryId,
          priceWithVat: price !== '' ? parseFloat(price) : 0,
          vatRate: parseFloat(vatRate),
        })
        router.push(`/admin/produkty/${result.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při vytváření produktu')
      }
    })
  }

  function toggleExpand(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const inputCls = (hasError?: boolean) =>
    `w-full rounded border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none ${
      hasError ? 'border-red-400' : 'border-stone-300'
    }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">

        {/* Hlavička */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="font-semibold text-stone-900">Přidat produkt</h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        {/* Tělo */}
        <div className="space-y-4 p-6">

          {/* Název */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Název <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              autoFocus
              placeholder="např. Hovězí svíčková"
              className={inputCls(!!errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Kategorie — drill-down dropdown */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Kategorie <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCatOpen((v) => !v)}
                className={`flex w-full items-center justify-between rounded border px-3 py-2 text-sm ${
                  errors.categoryId ? 'border-red-400' : 'border-stone-300'
                } ${selectedLabel ? 'text-stone-900' : 'text-stone-400'}`}
              >
                <span>{selectedLabel ?? 'Vyberte kategorii...'}</span>
                <span className="text-xs text-stone-400">{catOpen ? '▲' : '▼'}</span>
              </button>

              {catOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                  {categories.map((cat) => (
                    <div key={cat.id}>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryId(cat.id)
                            setCatOpen(false)
                          }}
                          className={`flex-1 px-3 py-1.5 text-left text-sm hover:bg-stone-50 ${
                            categoryId === cat.id ? 'font-medium text-blue-600' : 'text-stone-700'
                          }`}
                        >
                          {cat.name}
                        </button>
                        {cat.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(cat.id)}
                            className="px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-700"
                          >
                            {expandedCats.has(cat.id) ? '▲' : '▶'}
                          </button>
                        )}
                      </div>
                      {expandedCats.has(cat.id) &&
                        cat.children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => {
                              setCategoryId(child.id)
                              setCatOpen(false)
                            }}
                            className={`w-full py-1.5 pl-7 pr-3 text-left text-sm hover:bg-stone-50 ${
                              categoryId === child.id
                                ? 'font-medium text-blue-600'
                                : 'text-stone-500'
                            }`}
                          >
                            {cat.name} / {child.name}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-500">{errors.categoryId}</p>
            )}
          </div>

          {/* Cena + DPH */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                Cena s DPH
              </label>
              <div className="flex overflow-hidden rounded border border-stone-300 focus-within:border-blue-400">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className={`flex-1 px-3 py-2 text-sm focus:outline-none ${
                    errors.price ? 'border-red-400' : ''
                  }`}
                />
                <span className="flex items-center border-l border-stone-200 bg-stone-50 px-2 text-xs text-stone-500">
                  CZK
                </span>
              </div>
              {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                DPH <span className="text-red-500">*</span>
              </label>
              <select
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className={inputCls()}
              >
                <option value="12">12 % (potraviny)</option>
                <option value="21">21 % (standard)</option>
                <option value="0">0 % (osvobozeno)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Patička */}
        <div className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          >
            Zavřít
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            {isPending ? 'Ukládám…' : 'PŘIDAT'}
          </button>
        </div>
      </div>
    </div>
  )
}
