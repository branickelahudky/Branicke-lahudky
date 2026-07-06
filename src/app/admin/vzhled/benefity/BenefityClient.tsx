'use client'

// Správa benefitů (USP) — sortable seznam s inline editací a výběrem
// ikony z pevné sady. Vzor: MenuClient / HomepageClient (dnd-kit).

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { USP_ICONS, UspIcon } from '@/lib/usp-icons'
import {
  createUspItem, updateUspItem, deleteUspItem,
  toggleUspItemActive, reorderUspItems, type UspItemFormData,
} from './actions'

export type SerializedUspItem = {
  id: string
  icon: string
  title: string
  subtitle: string | null
  isActive: boolean
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'

// ── Formulář (nová položka i editace) ─────────────────────────────

function UspForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: UspItemFormData
  onSave: (data: UspItemFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [icon, setIcon] = useState(initial.icon)
  const [title, setTitle] = useState(initial.title)
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? '')

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Ikona</label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(USP_ICONS).map(([name, def]) => (
            <button
              key={name}
              type="button"
              onClick={() => setIcon(name)}
              title={def.label}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                icon === name
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600'
              }`}
            >
              <UspIcon name={name} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Titulek</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="např. Doprava zdarma" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Podtitulek (volitelný)</label>
        <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
          placeholder="např. Při nákupu nad 3 000 Kč" className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button
          disabled={saving || !title.trim()}
          onClick={() => onSave({ icon, title, subtitle: subtitle || null })}
          className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="rounded border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-40">
          Zrušit
        </button>
      </div>
    </div>
  )
}

// ── Řádek položky ─────────────────────────────────────────────────

function SortableItemRow({ item, readOnly }: { item: SerializedUspItem; readOnly: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  function run(fn: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn()
        toast.success(successMsg)
        setEditing(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-stone-200 bg-white ${isDragging ? 'opacity-60 shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {!readOnly && (
          <button {...attributes} {...listeners}
            className="cursor-grab text-stone-300 hover:text-stone-500 active:cursor-grabbing"
            title="Přetáhnout">⣿</button>
        )}

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <UspIcon name={item.icon} className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-stone-800">{item.title}</span>
          {item.subtitle && (
            <span className="block truncate text-xs text-stone-400">{item.subtitle}</span>
          )}
        </span>

        {!readOnly && (
          <>
            <button
              onClick={() => run(() => toggleUspItemActive(item.id), item.isActive ? 'Položka skryta.' : 'Položka zapnuta.')}
              disabled={isPending}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                item.isActive
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}>
              {item.isActive ? '● Aktivní' : '○ Skrytá'}
            </button>
            <button onClick={() => setEditing((e) => !e)}
              className="text-xs text-blue-600 hover:underline">
              {editing ? 'Zavřít' : 'Upravit'}
            </button>
            <button
              onClick={() => {
                if (!window.confirm(`Smazat benefit „${item.title}"?`)) return
                run(() => deleteUspItem(item.id), 'Položka smazána.')
              }}
              disabled={isPending}
              className="text-xs text-red-500 hover:underline">
              Smazat
            </button>
          </>
        )}
      </div>

      {editing && (
        <div className="border-t border-stone-100 px-4 py-4">
          <UspForm
            initial={{ icon: item.icon, title: item.title, subtitle: item.subtitle }}
            saving={isPending}
            onCancel={() => setEditing(false)}
            onSave={(data) => run(() => updateUspItem(item.id, data), 'Uloženo.')}
          />
        </div>
      )}
    </div>
  )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export function BenefityClient({ items: initialItems, readOnly }: { items: SerializedUspItem[]; readOnly: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [adding, setAdding] = useState(false)

  // Po router.refresh() (uložení/smazání) přeber čerstvá data ze serveru
  useEffect(() => { setItems(initialItems) }, [initialItems])
  const [isPending, startTransition] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const next = arrayMove(
        prev,
        prev.findIndex((i) => i.id === active.id),
        prev.findIndex((i) => i.id === over.id),
      )
      reorderUspItems(next.map((i) => i.id)).catch(() => toast.error('Chyba při ukládání pořadí'))
      return next
    })
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((item) => (
              <SortableItemRow key={item.id} item={item} readOnly={readOnly} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && !adding && (
        <div className="rounded-lg border-2 border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
          Zatím žádné benefity.
        </div>
      )}

      {!readOnly && (adding ? (
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-4">
          <p className="mb-3 text-sm font-semibold text-stone-700">Nový benefit</p>
          <UspForm
            initial={{ icon: 'star', title: '', subtitle: null }}
            saving={isPending}
            onCancel={() => setAdding(false)}
            onSave={(data) =>
              startTransition(async () => {
                try {
                  await createUspItem(data)
                  toast.success('Benefit přidán.')
                  setAdding(false)
                  router.refresh()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Chyba')
                }
              })
            }
          />
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600">
          + Přidat benefit
        </button>
      ))}
    </div>
  )
}
