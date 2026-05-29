'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { createCategory } from './actions'
import type { SerializedCategory } from './ProductsClient'

interface Props {
  categories: SerializedCategory[]
  onClose: () => void
  onSuccess: () => void
}

export function AddCategoryModal({ categories, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Název je povinný.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    startTransition(async () => {
      try {
        await createCategory({
          name: name.trim(),
          parentId: parentId || null,
        })
        toast.success('Kategorie vytvořena')
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při vytváření kategorie')
      }
    })
  }

  // Hierarchický seznam pro select (parentId options)
  const parentOptions: Array<{ value: string; label: string }> = []
  for (const cat of categories) {
    parentOptions.push({ value: cat.id, label: cat.name })
    for (const child of cat.children) {
      parentOptions.push({ value: child.id, label: `${cat.name} › ${child.name}` })
    }
  }

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
          <h3 className="font-semibold text-stone-900">Přidat kategorii</h3>
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
              maxLength={100}
              autoFocus
              placeholder="např. Jehněčí maso"
              className={`w-full rounded border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none ${
                errors.name ? 'border-red-400' : 'border-stone-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Nadřazená kategorie */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Nadřazená kategorie
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">Žádná (hlavní kategorie)</option>
              {parentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-400">
              Pokud necháte prázdné, vytvoří se nová hlavní kategorie.
            </p>
          </div>

          {/* Pozice (read-only) */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-stone-700">
              Pozice
              <span
                title="Drag-drop přeřazení bude dostupné v sekci Správa kategorií"
                className="cursor-help text-stone-400"
              >
                ⓘ
              </span>
            </label>
            <input
              type="text"
              value="Poslední pozice"
              disabled
              className="w-full cursor-not-allowed rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-400"
            />
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
