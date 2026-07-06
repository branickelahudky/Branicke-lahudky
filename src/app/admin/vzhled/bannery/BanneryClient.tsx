'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  createBanner, updateBanner, deleteBanner, toggleBannerVisibility, reorderBanners,
  type BannerFormData,
} from './actions'
import type { BannerLinkType, BannerPlacement } from '@prisma/client'

// ── Typy ─────────────────────────────────────────────────────────

export type SerializedBanner = {
  id: string
  imageUrl: string
  imageStorageKey: string
  imageAlt: string | null
  placement: BannerPlacement
  title: string | null
  subtitle: string | null
  linkType: BannerLinkType
  pageId: string | null
  pageName: string | null
  categoryId: string | null
  categoryName: string | null
  url: string | null
  openNewTab: boolean
  sortOrder: number
  isVisible: boolean
}

export type PageOption = { id: string; title: string; slug: string }
export type CategoryOption = { id: string; displayName: string }

interface Props {
  banners: SerializedBanner[]
  pages: PageOption[]
  categories: CategoryOption[]
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 15
const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'
const LINK_LABELS: Record<BannerLinkType, string> = {
  NONE: 'Bez odkazu', PAGE: 'Stránka', CATEGORY: 'Kategorie', URL: 'Vlastní URL',
}

// ── Umístění bannerů ──────────────────────────────────────────────

type PlacementMeta = { value: BannerPlacement; label: string; short: string; dims: string; aspect: string }

const PLACEMENTS: PlacementMeta[] = [
  { value: 'CAROUSEL',    label: 'Carousel (hlavní nahoře)',        short: 'Carousel',       dims: '1920×720 (16:6)', aspect: 'aspect-[16/6]'  },
  { value: 'PROMO_TILE',  label: 'Promo dlaždice (pod carouselem)', short: 'Promo dlaždice', dims: '600×400 (3:2)',   aspect: 'aspect-[3/2]'   },
  { value: 'MID_WIDE',    label: 'Široký banner (mezi regály)',     short: 'Široký banner',  dims: '1920×480 (4:1)',  aspect: 'aspect-[4/1]'   },
  { value: 'FOOTER_CARD', label: 'Karta nad patičkou',              short: 'Karta patička',  dims: '800×500 (16:10)', aspect: 'aspect-[16/10]' },
]

const PLACEMENT_META: Record<BannerPlacement, PlacementMeta> = Object.fromEntries(
  PLACEMENTS.map((p) => [p.value, p]),
) as Record<BannerPlacement, PlacementMeta>

// ── Upload widget ─────────────────────────────────────────────────

function ImageUpload({
  currentUrl,
  onUploaded,
  aspect = 'aspect-[16/6]',
  hint,
}: {
  currentUrl: string | null
  onUploaded: (imageUrl: string, storageKey: string) => void
  aspect?: string
  hint?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) { toast.error('Povolené formáty: JPG, PNG, WebP'); return }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Max ${MAX_MB} MB`); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/banner/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chyba')
      onUploaded(data.imageUrl, data.storageKey)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba při nahrávání')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) upload(f)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      {/* Preview */}
      {currentUrl && (
        <div className={`relative w-full ${aspect} overflow-hidden rounded-lg border border-stone-200 bg-stone-100`}>
          <Image src={currentUrl} alt="Náhled banneru" fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-sm transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-stone-300 bg-stone-50 hover:border-stone-400'
        } ${uploading ? 'cursor-wait opacity-60' : ''}`}
      >
        {uploading
          ? <span className="text-stone-500">Nahrávám…</span>
          : <span className="text-stone-500">
              <span className="font-medium text-blue-600">{currentUrl ? 'Nahradit' : 'Vybrat'} obrázek</span>
              {' '}nebo přetáhnout
            </span>
        }
      </div>
      <p className="text-xs text-stone-400">JPG, PNG, WebP · max {MAX_MB} MB{hint ? ` · ${hint}` : ''}</p>
      <input ref={inputRef} type="file" accept={ALLOWED.join(',')} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
    </div>
  )
}

// ── Formulář banneru (shared add + edit) ──────────────────────────

function BannerForm({
  initial,
  defaultPlacement,
  pages,
  categories,
  onClose,
  onSave,
}: {
  initial?: SerializedBanner
  defaultPlacement?: BannerPlacement
  pages: PageOption[]
  categories: CategoryOption[]
  onClose: () => void
  onSave: (data: BannerFormData & { id?: string }) => Promise<void>
}) {
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '')
  const [storageKey, setStorageKey] = useState(initial?.imageStorageKey ?? '')
  const [imageAlt, setImageAlt] = useState(initial?.imageAlt ?? '')
  const [placement, setPlacement] = useState<BannerPlacement>(initial?.placement ?? defaultPlacement ?? 'CAROUSEL')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '')
  const [linkType, setLinkType] = useState<BannerLinkType>(initial?.linkType ?? 'NONE')
  const [pageId, setPageId] = useState(initial?.pageId ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [openNewTab, setOpenNewTab] = useState(initial?.openNewTab ?? false)
  const [isPending, startTransition] = useTransition()

  const placementMeta = PLACEMENT_META[placement]

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function handleSave() {
    if (!imageUrl) { toast.error('Nahrajte obrázek banneru.'); return }
    startTransition(async () => {
      try {
        await onSave({
          id: initial?.id,
          imageUrl, imageStorageKey: storageKey,
          imageAlt: imageAlt || null,
          placement,
          title: title || null,
          subtitle: subtitle || null,
          linkType,
          pageId: pageId || null,
          categoryId: categoryId || null,
          url: url || null,
          openNewTab,
        })
        toast.success(initial ? 'Banner upraven' : 'Banner přidán')
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl my-4">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">{initial ? 'Upravit banner' : 'Přidat banner'}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Umístění */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Umístění</label>
            <select value={placement} onChange={(e) => setPlacement(e.target.value as BannerPlacement)} className={inputCls}>
              {PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-400">Doporučený rozměr: {placementMeta.dims}</p>
          </div>

          {/* Upload */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Obrázek *</label>
            <ImageUpload
              currentUrl={imageUrl || null}
              onUploaded={(u, k) => { setImageUrl(u); setStorageKey(k) }}
              aspect={placementMeta.aspect}
              hint={`doporučený rozměr ${placementMeta.dims}`}
            />
          </div>

          {/* Titulek + podtitulek */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Titulek (nepovinný)</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="např. Cenové trháky týdne" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Podtitulek (nepovinný)</label>
              <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                placeholder="např. sleva až 53 %" className={inputCls} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-stone-400">
            Titulek/podtitulek se zobrazí u promo dlaždic, širokého banneru a karet nad patičkou.
          </p>

          {/* Alt */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Alt text (přístupnost)</label>
            <input type="text" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)}
              placeholder="Popis obsahu obrázku" className={inputCls} />
          </div>

          {/* Link type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">Odkaz při kliknutí</label>
            <div className="flex flex-wrap gap-1.5">
              {(['NONE', 'PAGE', 'CATEGORY', 'URL'] as BannerLinkType[]).map((t) => (
                <button key={t} type="button" onClick={() => setLinkType(t)}
                  className={`rounded border px-3 py-1 text-sm transition ${
                    linkType === t ? 'border-blue-500 bg-blue-50 font-medium text-blue-700' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}>
                  {LINK_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {linkType === 'PAGE' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Stránka</label>
              <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={inputCls}>
                <option value="">— Vyberte stránku —</option>
                {pages.map((p) => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
              </select>
            </div>
          )}

          {linkType === 'CATEGORY' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Kategorie</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">— Vyberte kategorii —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
              </select>
            </div>
          )}

          {linkType === 'URL' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">URL adresa</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..." className={inputCls} />
            </div>
          )}

          {linkType !== 'NONE' && (
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={openNewTab}
                onChange={(e) => setOpenNewTab(e.target.checked)} className="rounded" />
              <span className="text-sm text-stone-700">Otevřít v novém okně</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">
          <button onClick={onClose}
            className="rounded border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            {isPending ? 'Ukládám…' : initial ? 'Uložit' : 'Přidat banner'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sortable karta banneru ─────────────────────────────────────────

function SortableBannerCard({
  banner,
  onEdit,
  onDelete,
  onToggle,
}: {
  banner: SerializedBanner
  onEdit: (b: SerializedBanner) => void
  onDelete: (b: SerializedBanner) => void
  onToggle: (b: SerializedBanner) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const linkDesc =
    banner.linkType === 'PAGE' ? banner.pageName ?? '—'
    : banner.linkType === 'CATEGORY' ? banner.categoryName ?? '—'
    : banner.linkType === 'URL' ? banner.url ?? '—'
    : 'Bez odkazu'

  return (
    <div ref={setNodeRef} style={style}
      className={`relative rounded-lg border overflow-hidden bg-white shadow-sm transition-all ${
        banner.isVisible ? 'border-stone-200' : 'border-stone-200 opacity-60'
      }`}
    >
      {/* Obrázek */}
      <div className={`relative ${PLACEMENT_META[banner.placement].aspect} bg-stone-100`}>
        <Image src={banner.imageUrl} alt={banner.imageAlt ?? 'Banner'} fill
          className="object-cover" unoptimized />
        {/* Drag handle */}
        <div {...attributes} {...listeners}
          className="absolute top-2 left-2 cursor-grab rounded bg-black/50 p-1.5 active:cursor-grabbing"
          title="Přetáhnout">
          <span className="text-white text-xs">⣿</span>
        </div>
        {/* Visibility badge */}
        {!banner.isVisible && (
          <div className="absolute top-2 right-2 rounded bg-stone-800/70 px-2 py-0.5 text-xs text-white">
            Skrytý
          </div>
        )}
      </div>

      {/* Info + akce */}
      <div className="px-3 py-2.5">
        {(banner.title || banner.subtitle) && (
          <p className="mb-1 truncate text-sm font-medium text-stone-800">
            {banner.title}
            {banner.subtitle && <span className="ml-1.5 font-normal text-stone-400">{banner.subtitle}</span>}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {banner.linkType === 'NONE' ? (
              <span
                className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700"
                title="Banner nikam nevede — návštěvník na něj nemůže kliknout. Odkaz nastavíte v úpravě banneru."
              >
                ⚠ Bez odkazu
              </span>
            ) : (
              <>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                  {LINK_LABELS[banner.linkType]}
                </span>
                <span className="ml-1.5 text-xs text-stone-400 truncate">{linkDesc}</span>
              </>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => onToggle(banner)}
              className={`rounded border px-2 py-0.5 text-xs transition ${
                banner.isVisible
                  ? 'border-green-200 text-green-700 hover:bg-green-50'
                  : 'border-stone-200 text-stone-500 hover:bg-stone-50'
              }`}>
              {banner.isVisible ? 'Viditelný' : 'Skrytý'}
            </button>
            <button onClick={() => onEdit(banner)}
              className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-50">
              Upravit
            </button>
            <button onClick={() => onDelete(banner)}
              className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-500 hover:bg-red-50">
              Smazat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export function BanneryClient({ banners: initialBanners, pages, categories }: Props) {
  const [banners, setBanners] = useState<SerializedBanner[]>(initialBanners)
  const [activePlacement, setActivePlacement] = useState<BannerPlacement>('CAROUSEL')
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<SerializedBanner | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const visible = banners.filter((b) => b.placement === activePlacement)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const group = banners.filter((b) => b.placement === activePlacement)
    const oldIdx = group.findIndex((b) => b.id === active.id)
    const newIdx = group.findIndex((b) => b.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(group, oldIdx, newIdx)
    // Slož zpět: ostatní umístění beze změny + přerovnaná skupina
    const others = banners.filter((b) => b.placement !== activePlacement)
    setBanners([...others, ...reordered])
    reorderBanners(reordered.map((b) => b.id)).catch(() => toast.error('Chyba při ukládání pořadí'))
  }

  async function handleCreate(data: BannerFormData & { id?: string }) {
    await createBanner(data)
    startTransition(() => { window.location.reload() })
  }

  async function handleUpdate(data: BannerFormData & { id?: string }) {
    if (!data.id) return
    await updateBanner(data.id, data)
    startTransition(() => { window.location.reload() })
  }

  async function handleDelete(banner: SerializedBanner) {
    if (!confirm(`Smazat banner? Soubor z R2 bude také odstraněn.`)) return
    try {
      await deleteBanner(banner.id)
      setBanners((prev) => prev.filter((b) => b.id !== banner.id))
      toast.success('Banner smazán')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  async function handleToggle(banner: SerializedBanner) {
    try {
      await toggleBannerVisibility(banner.id)
      setBanners((prev) => prev.map((b) => b.id === banner.id ? { ...b, isVisible: !b.isVisible } : b))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    }
  }

  const activeMeta = PLACEMENT_META[activePlacement]

  return (
    <div className="space-y-4">
      {/* Záložky umístění */}
      <div className="flex flex-wrap gap-1.5 border-b border-stone-200 pb-3">
        {PLACEMENTS.map((p) => {
          const count = banners.filter((b) => b.placement === p.value).length
          const active = activePlacement === p.value
          return (
            <button key={p.value} onClick={() => setActivePlacement(p.value)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                active ? 'border-blue-500 bg-blue-50 font-medium text-blue-700' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}>
              {p.short}
              <span className={`ml-1.5 text-xs ${active ? 'text-blue-400' : 'text-stone-400'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-700">{activeMeta.label}</span>
          <span className="ml-2 text-stone-400">doporučený rozměr {activeMeta.dims}</span>
        </p>
        <button onClick={() => setShowAdd(true)}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          + Přidat banner
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-200 py-16 text-center">
          <div className="mb-3 text-5xl text-stone-200">🖼</div>
          <p className="font-medium text-stone-500">Žádné bannery v této pozici</p>
          <p className="mt-1 text-sm text-stone-400">Přidejte banner tlačítkem výše — uloží se do „{activeMeta.short}".</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((b) => b.id)} strategy={rectSortingStrategy}>
            <div className="space-y-3">
              {visible.map((banner) => (
                <SortableBannerCard
                  key={banner.id}
                  banner={banner}
                  onEdit={setEditTarget}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAdd && (
        <BannerForm defaultPlacement={activePlacement} pages={pages} categories={categories}
          onClose={() => setShowAdd(false)} onSave={handleCreate} />
      )}
      {editTarget && (
        <BannerForm initial={editTarget} pages={pages} categories={categories}
          onClose={() => setEditTarget(null)} onSave={handleUpdate} />
      )}
    </div>
  )
}
