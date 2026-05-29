'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatCZK } from '@/lib/pricing'
import {
  createProductVariant, updateProductVariant, deleteProductVariant,
  reorderProductVariants, type VariantData,
} from './actions'
import type { SerializedVariant } from './ProductDetailClient'

interface Props {
  productId: string
  variants: SerializedVariant[]
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'

// ── Sortable row ─────────────────────────────────────────────────

function SortableRow({
  variant,
  onEdit,
  onDelete,
}: {
  variant: SerializedVariant
  onEdit: (v: SerializedVariant) => void
  onDelete: (v: SerializedVariant) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: variant.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-stone-100 hover:bg-stone-50">
      <td className="px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 text-stone-300 hover:text-stone-500 active:cursor-grabbing"
          title="Přetáhnout"
        >
          ⣿
        </button>
      </td>
      <td className="px-3 py-2.5 text-sm font-medium text-stone-800">{variant.name}</td>
      <td className="px-3 py-2.5 text-sm font-mono text-stone-500">{variant.sku ?? '—'}</td>
      <td className="px-3 py-2.5 text-sm text-stone-600">
        {variant.weightKg != null ? `${Math.round(variant.weightKg * 1000)} g` : '—'}
      </td>
      <td className="px-3 py-2.5 text-sm font-medium text-stone-800">
        {formatCZK(variant.priceWithVat)}
      </td>
      <td className="px-3 py-2.5 text-sm text-stone-600">{variant.stockQuantity} ks</td>
      <td className="px-3 py-2.5">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${variant.isActive ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
          {variant.isActive ? 'Aktivní' : 'Skrytá'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(variant)}
            className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
          >
            Upravit
          </button>
          <button
            onClick={() => onDelete(variant)}
            className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            Smazat
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Variant modal ─────────────────────────────────────────────────

function VariantModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: SerializedVariant
  onClose: () => void
  onSave: (data: VariantData) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [price, setPrice] = useState(initial ? String(initial.priceWithVat) : '')
  const [weightG, setWeightG] = useState(
    initial?.weightKg != null ? String(Math.round(initial.weightKg * 1000)) : ''
  )
  const [stock, setStock] = useState(initial ? String(initial.stockQuantity) : '0')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [isPending, startTransition] = useTransition()
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function handleSave() {
    if (!name.trim()) { toast.error('Zadejte název varianty.'); return }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Zadejte platnou cenu.'); return }

    startTransition(async () => {
      try {
        await onSave({
          name: name.trim(),
          sku: sku.trim() || null,
          priceWithVat: priceNum,
          weightKg: weightG ? parseFloat(weightG) / 1000 : null,
          stockQuantity: parseInt(stock) || 0,
          isActive,
        })
        toast.success(initial ? 'Varianta upravena' : 'Varianta přidána')
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">{initial ? 'Upravit variantu' : 'Přidat variantu'}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Název *</label>
            <input ref={firstRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="např. 200 g" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">SKU</label>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)}
                placeholder="volitelné" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Cena s DPH (Kč) *</label>
              <input type="number" min="0" step="0.01" value={price}
                onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Hmotnost (g)</label>
              <input type="number" min="0" step="1" value={weightG}
                onChange={(e) => setWeightG(e.target.value)} placeholder="volitelné" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Sklad (ks)</label>
              <input type="number" min="0" step="1" value={stock}
                onChange={(e) => setStock(e.target.value)} className={inputCls} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            <span className="text-sm text-stone-700">Varianta aktivní (viditelná zákazníkům)</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button onClick={onClose}
            className="rounded border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            {isPending ? 'Ukládám…' : initial ? 'Uložit' : 'Vytvořit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export function VariantsTab({ productId, variants: initialVariants }: Props) {
  const [variants, setVariants] = useState<SerializedVariant[]>(initialVariants)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<SerializedVariant | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setVariants((prev) => {
      const oldIdx = prev.findIndex((v) => v.id === active.id)
      const newIdx = prev.findIndex((v) => v.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx)
      reorderProductVariants(productId, next.map((v) => v.id)).catch(() => {
        toast.error('Chyba při ukládání pořadí')
      })
      return next
    })
  }

  async function handleCreate(data: VariantData) {
    await createProductVariant(productId, data)
    startTransition(() => { window.location.reload() })
  }

  async function handleUpdate(data: VariantData) {
    if (!editTarget) return
    await updateProductVariant(editTarget.id, data)
    startTransition(() => { window.location.reload() })
  }

  async function handleDelete(variant: SerializedVariant) {
    if (!confirm(`Smazat variantu „${variant.name}"?`)) return
    try {
      await deleteProductVariant(variant.id)
      setVariants((prev) => prev.filter((v) => v.id !== variant.id))
      toast.success('Varianta smazána')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-700">Varianty produktu</h3>
          <p className="mt-0.5 text-xs text-stone-400">
            Nabízíte-li produkt ve více velikostech nebo hmotnostech (200 g / 500 g / 1 kg), vytvořte varianty s vlastními cenami.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Přidat variantu
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-200 py-12 text-center">
          <div className="mb-3 text-4xl text-stone-200">▤</div>
          <p className="font-medium text-stone-500">Tento produkt nemá varianty</p>
          <p className="mt-1 text-sm text-stone-400">
            Pokud máte různé velikosti nebo váhy, přidejte je tlačítkem výše.
          </p>
          <div className="mt-3 rounded-md bg-stone-50 px-4 py-2 text-xs text-stone-400">
            Bez variant se produkt zobrazí s jednou cenou.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400 w-10"></th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Název</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">SKU</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Hmotnost</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Cena s DPH</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Sklad</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Stav</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Akce</th>
              </tr>
            </thead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={variants.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {variants.map((v) => (
                    <SortableRow
                      key={v.id}
                      variant={v}
                      onEdit={setEditTarget}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
      )}

      {showAdd && (
        <VariantModal onClose={() => setShowAdd(false)} onSave={handleCreate} />
      )}
      {editTarget && (
        <VariantModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleUpdate} />
      )}
    </div>
  )
}
