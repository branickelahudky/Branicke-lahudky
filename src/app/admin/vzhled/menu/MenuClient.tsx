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
import {
  createMenuItem, updateMenuItem, deleteMenuItem,
  toggleMenuItemVisibility, reorderMenuItems, type MenuItemFormData,
} from './actions'
import type { MenuLocation } from '@prisma/client'

// ── Typy ─────────────────────────────────────────────────────────

export type SerializedMenuItem = {
  id: string
  location: MenuLocation
  label: string
  linkType: 'PAGE' | 'CATEGORY' | 'URL'
  pageId: string | null
  pageName: string | null
  categoryId: string | null
  categoryName: string | null
  url: string | null
  openNewTab: boolean
  sortOrder: number
  isVisible: boolean
}

export type SerializedPageOption = { id: string; title: string; slug: string }
export type SerializedCategoryOption = { id: string; displayName: string }

interface Props {
  headerItems: SerializedMenuItem[]
  footerItems: SerializedMenuItem[]
  pages: SerializedPageOption[]
  categories: SerializedCategoryOption[]
}

const LINK_TYPE_LABELS = { PAGE: 'Stránka', CATEGORY: 'Kategorie', URL: 'Vlastní URL' }
const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'

// ── Sortable row ──────────────────────────────────────────────────

function SortableRow({
  item, onEdit, onDelete, onToggle,
}: {
  item: SerializedMenuItem
  onEdit: (item: SerializedMenuItem) => void
  onDelete: (item: SerializedMenuItem) => void
  onToggle: (item: SerializedMenuItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const linkDesc =
    item.linkType === 'PAGE' ? item.pageName ?? '—'
    : item.linkType === 'CATEGORY' ? item.categoryName ?? '—'
    : item.url ?? '—'

  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 shadow-sm">
      {/* Drag handle */}
      <button {...attributes} {...listeners}
        className="cursor-grab p-1 text-stone-300 hover:text-stone-500 active:cursor-grabbing shrink-0"
        title="Přetáhnout">⣿</button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <span className={`text-sm font-medium ${item.isVisible ? 'text-stone-800' : 'text-stone-400'}`}>
          {item.label}
        </span>
        <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
          {LINK_TYPE_LABELS[item.linkType]}
        </span>
        <span className="ml-1.5 text-xs text-stone-400 truncate">{linkDesc}</span>
        {item.openNewTab && <span className="ml-1.5 text-xs text-stone-400">↗</span>}
      </div>

      {/* Visibility toggle */}
      <button onClick={() => onToggle(item)}
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition ${
          item.isVisible ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
        }`}>
        {item.isVisible ? '● Viditelná' : '○ Skrytá'}
      </button>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        <button onClick={() => onEdit(item)}
          className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50">
          Upravit
        </button>
        <button onClick={() => onDelete(item)}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50">
          Smazat
        </button>
      </div>
    </div>
  )
}

// ── Modal pro přidání / editaci ──────────────────────────────────

function ItemModal({
  initial, location, pages, categories, onClose, onSave,
}: {
  initial?: SerializedMenuItem
  location: MenuLocation
  pages: SerializedPageOption[]
  categories: SerializedCategoryOption[]
  onClose: () => void
  onSave: (data: MenuItemFormData) => Promise<void>
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [linkType, setLinkType] = useState<'PAGE' | 'CATEGORY' | 'URL'>(initial?.linkType ?? 'URL')
  const [pageId, setPageId] = useState(initial?.pageId ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [openNewTab, setOpenNewTab] = useState(initial?.openNewTab ?? false)
  const [isPending, startTransition] = useTransition()
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function handleSave() {
    startTransition(async () => {
      try {
        await onSave({
          location,
          label,
          linkType,
          pageId: pageId || null,
          categoryId: categoryId || null,
          url: url || null,
          openNewTab,
        })
        toast.success(initial ? 'Položka upravena' : 'Položka přidána')
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">{initial ? 'Upravit položku' : 'Přidat položku'}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Label */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Název odkazu *</label>
            <input ref={labelRef} type="text" value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="např. O nás" className={inputCls} />
          </div>

          {/* Link type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Typ odkazu</label>
            <div className="flex gap-2">
              {(['PAGE', 'CATEGORY', 'URL'] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => setLinkType(t)}
                  className={`flex-1 rounded border py-1.5 text-sm transition ${
                    linkType === t ? 'border-blue-500 bg-blue-50 font-medium text-blue-700' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}>
                  {LINK_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Page select */}
          {linkType === 'PAGE' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Stránka</label>
              <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={inputCls}>
                <option value="">— Vyberte stránku —</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>
                ))}
              </select>
            </div>
          )}

          {/* Category select */}
          {linkType === 'CATEGORY' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Kategorie</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">— Vyberte kategorii —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom URL */}
          {linkType === 'URL' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">URL adresa</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... nebo /interní-odkaz" className={inputCls} />
            </div>
          )}

          {/* New tab */}
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={openNewTab}
              onChange={(e) => setOpenNewTab(e.target.checked)} className="rounded" />
            <span className="text-sm text-stone-700">Otevřít v novém okně</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button onClick={onClose}
            className="rounded border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            {isPending ? 'Ukládám…' : initial ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Menu list pro jednu lokaci ─────────────────────────────────────

function MenuList({
  location, items: initialItems, pages, categories,
}: {
  location: MenuLocation
  items: SerializedMenuItem[]
  pages: SerializedPageOption[]
  categories: SerializedCategoryOption[]
}) {
  const [items, setItems] = useState<SerializedMenuItem[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<SerializedMenuItem | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id)
      const newIdx = prev.findIndex((i) => i.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx)
      reorderMenuItems(location, next.map((i) => i.id)).catch(() => toast.error('Chyba při ukládání pořadí'))
      return next
    })
  }

  async function handleCreate(data: MenuItemFormData) {
    await createMenuItem(data)
    startTransition(() => { window.location.reload() })
  }

  async function handleUpdate(data: MenuItemFormData) {
    if (!editTarget) return
    await updateMenuItem(editTarget.id, data)
    startTransition(() => { window.location.reload() })
  }

  async function handleDelete(item: SerializedMenuItem) {
    if (!confirm(`Smazat položku „${item.label}"?`)) return
    try {
      await deleteMenuItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success('Položka smazána')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  async function handleToggle(item: SerializedMenuItem) {
    try {
      await toggleMenuItemVisibility(item.id)
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isVisible: !i.isVisible } : i))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-stone-200 py-10 text-center">
          <p className="text-sm text-stone-400">Žádné položky — přidejte první tlačítkem níže.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item) => (
                <SortableRow key={item.id} item={item}
                  onEdit={setEditTarget}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button onClick={() => setShowAdd(true)}
        className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
        + Přidat položku
      </button>

      {showAdd && (
        <ItemModal location={location} pages={pages} categories={categories}
          onClose={() => setShowAdd(false)} onSave={handleCreate} />
      )}
      {editTarget && (
        <ItemModal initial={editTarget} location={location} pages={pages} categories={categories}
          onClose={() => setEditTarget(null)} onSave={handleUpdate} />
      )}
    </div>
  )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export function MenuClient({ headerItems, footerItems, pages, categories }: Props) {
  const [activeTab, setActiveTab] = useState<'HEADER' | 'FOOTER'>('HEADER')

  const tabCls = (tab: 'HEADER' | 'FOOTER') =>
    `relative px-5 py-3 text-sm transition ${
      activeTab === tab ? 'font-semibold text-stone-900' : 'text-stone-500 hover:text-stone-700'
    }`

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      {/* Tab lišta */}
      <div className="flex border-b border-stone-200">
        {(['HEADER', 'FOOTER'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={tabCls(tab)}>
            {activeTab === tab && (
              <span className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-blue-500" />
            )}
            {tab === 'HEADER' ? 'Hlavní menu' : 'Patička'}
            <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
              {tab === 'HEADER' ? headerItems.length : footerItems.length}
            </span>
          </button>
        ))}
      </div>

      {/* Obsah */}
      <div className="p-5">
        {activeTab === 'HEADER' ? (
          <MenuList location="HEADER" items={headerItems} pages={pages} categories={categories} />
        ) : (
          <MenuList location="FOOTER" items={footerItems} pages={pages} categories={categories} />
        )}
      </div>
    </div>
  )
}
