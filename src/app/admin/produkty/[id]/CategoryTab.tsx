'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateProductCategory, createCategory } from './actions'
import type { SerializedCategoryForModal } from './ProductDetailClient'

interface Props {
  productId: string
  currentCategoryId: string
  categories: SerializedCategoryForModal[]
}

export function CategoryTab({ productId, currentCategoryId, categories }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState(currentCategoryId)
  const [showNewCatModal, setShowNewCatModal] = useState(false)

  // sync when server refreshes
  useEffect(() => {
    setSelectedId(currentCategoryId)
  }, [currentCategoryId])

  function handleSave() {
    startTransition(async () => {
      try {
        await updateProductCategory(productId, selectedId)
        toast.success('Kategorie uložena')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  const isDirty = selectedId !== currentCategoryId

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-sm font-medium text-stone-700">Vyberte kategorii produktu</p>
        <div className="rounded-lg border border-stone-200 overflow-hidden">
          {categories.map((cat) => (
            <div key={cat.id}>
              {/* Rodičovská kategorie */}
              <label className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50 border-b border-stone-100 last:border-b-0 ${selectedId === cat.id ? 'bg-blue-50' : ''}`}>
                <input
                  type="radio"
                  name="category"
                  value={cat.id}
                  checked={selectedId === cat.id}
                  onChange={() => setSelectedId(cat.id)}
                  className="text-blue-600"
                />
                <span className={`text-sm font-medium ${selectedId === cat.id ? 'text-blue-700' : 'text-stone-800'}`}>
                  {cat.name}
                </span>
              </label>

              {/* Podkategorie */}
              {cat.children.map((child) => (
                <label
                  key={child.id}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-stone-50 border-b border-stone-100 last:border-b-0 ${selectedId === child.id ? 'bg-blue-50' : ''}`}
                  style={{ paddingLeft: 40 }}
                >
                  <input
                    type="radio"
                    name="category"
                    value={child.id}
                    checked={selectedId === child.id}
                    onChange={() => setSelectedId(child.id)}
                    className="text-blue-600"
                  />
                  <span className={`text-sm ${selectedId === child.id ? 'text-blue-700 font-medium' : 'text-stone-600'}`}>
                    {child.name}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending || !isDirty}
          className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          {isPending ? 'Ukládám…' : 'Uložit kategorii'}
        </button>
        {!isDirty && (
          <span className="text-xs text-stone-400">Žádné změny</span>
        )}
      </div>

      <div className="border-t border-stone-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Rychlé akce</p>
        <button
          onClick={() => setShowNewCatModal(true)}
          className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
        >
          + Přidat novou kategorii
        </button>
      </div>

      {showNewCatModal && (
        <NewCategoryModal
          categories={categories}
          onClose={() => setShowNewCatModal(false)}
          onCreated={() => {
            setShowNewCatModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function NewCategoryModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: SerializedCategoryForModal[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleCreate() {
    if (!name.trim()) {
      toast.error('Zadejte název kategorie.')
      return
    }
    startTransition(async () => {
      try {
        await createCategory(name.trim(), parentId || null)
        toast.success(`Kategorie „${name.trim()}" vytvořena`)
        onCreated()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při vytváření')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">Nová kategorie</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Název kategorie</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="např. Uzeniny"
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Nadřazená kategorie (volitelně)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">— Žádná (hlavní kategorie) —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Zrušit
          </button>
          <button
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isPending ? 'Vytváří se…' : 'Vytvořit'}
          </button>
        </div>
      </div>
    </div>
  )
}
