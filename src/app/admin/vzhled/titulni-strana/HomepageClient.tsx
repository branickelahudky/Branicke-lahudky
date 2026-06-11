'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  toggleSectionVisibility, reorderSections,
  saveCarouselSection, saveFeaturedCategories,
  saveFeaturedProducts, saveAboutText, saveSectionTitle,
  searchProductsForHomepage, type FeaturedProductsMode,
} from './actions'
import type { HomepageSectionType } from '@prisma/client'

// ── Typy ─────────────────────────────────────────────────────────

export type SerializedSection = {
  id: string
  type: HomepageSectionType
  isVisible: boolean
  sortOrder: number
  title: string | null
  config: unknown
}

export type CategoryOption = { id: string; displayName: string }
export type ProductSearchResult = {
  id: string; name: string; sku: string; priceWithVat: number; isFeatured: boolean; thumbnailUrl: string | null
}

interface Props {
  sections: SerializedSection[]
  categories: CategoryOption[]
  bannerCounts: Record<string, number>
}

const TYPE_LABELS: Record<HomepageSectionType, string> = {
  CAROUSEL: 'Banner carousel',
  FEATURED_CATEGORIES: 'Vybrané kategorie',
  FEATURED_PRODUCTS: 'Doporučené produkty',
  ABOUT_TEXT: 'O nás',
  PROMO_TILES: 'Promo dlaždice',
  MID_BANNER: 'Široký banner',
  FOOTER_CARDS: 'Karty nad patičkou',
}

// Sekce řízené bannery → odpovídající BannerPlacement + popis pro admin
const BANNER_SECTIONS: Partial<Record<HomepageSectionType, { placement: string; note: string }>> = {
  CAROUSEL:     { placement: 'CAROUSEL',    note: 'hlavní carousel nahoře' },
  PROMO_TILES:  { placement: 'PROMO_TILE',  note: 'mřížka promo dlaždic pod carouselem' },
  MID_BANNER:   { placement: 'MID_WIDE',    note: 'široký banner mezi regály (zobrazí se první aktivní)' },
  FOOTER_CARDS: { placement: 'FOOTER_CARD', note: 'trojice karet nad patičkou (max 3)' },
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'

// ── Konfigurace sekce CAROUSEL ────────────────────────────────────

function CarouselConfig({ section }: { section: SerializedSection }) {
  const [title, setTitle] = useState(section.title ?? '')
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-500">
        Bannery se spravují v sekci{' '}
        <a href="/admin/vzhled/bannery" className="underline text-blue-600">Vzhled webu → Bannery</a>.
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Nadpis sekce (volitelný)</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="např. Aktuální nabídka" className={inputCls} />
      </div>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => {
          try { await saveCarouselSection(section.id, title || null); toast.success('Uloženo') }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Chyba') }
        })}
        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit'}
      </button>
    </div>
  )
}

// ── Konfigurace banner sekcí (PROMO_TILES, MID_BANNER, FOOTER_CARDS) ─

function BannerSectionConfig({ section, count }: { section: SerializedSection; count: number }) {
  const [title, setTitle] = useState(section.title ?? '')
  const [isPending, startTransition] = useTransition()
  const meta = BANNER_SECTIONS[section.type]

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-500">
        Obsah ({meta?.note}) spravujte v sekci{' '}
        <a href="/admin/vzhled/bannery" className="underline text-blue-600">Vzhled webu → Bannery</a>
        {' '}u banneru zvolte umístění odpovídající této sekci.
        <span className="mt-1 block font-medium text-stone-600">{count} aktivních bannerů v této pozici</span>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Nadpis sekce (volitelný)</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="např. Tipy pro vás" className={inputCls} />
      </div>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => {
          try { await saveSectionTitle(section.id, title || null); toast.success('Uloženo') }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Chyba') }
        })}
        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit'}
      </button>
    </div>
  )
}

// ── Konfigurace sekce FEATURED_CATEGORIES ─────────────────────────

function FeaturedCategoriesConfig({ section, categories }: { section: SerializedSection; categories: CategoryOption[] }) {
  const cfg = (section.config as { categoryIds?: string[] } | null) ?? {}
  const [title, setTitle] = useState(section.title ?? '')
  const [selected, setSelected] = useState<string[]>(cfg.categoryIds ?? [])
  const [isPending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 8 ? [...prev, id] : prev
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Nadpis sekce</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="např. Naše kategorie" className={inputCls} />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-stone-600">
          Vybrané kategorie <span className="text-stone-400">({selected.length}/8)</span>
        </p>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
          {categories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-stone-50">
              <input type="checkbox" checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                disabled={!selected.includes(c.id) && selected.length >= 8}
                className="rounded" />
              <span className="text-sm text-stone-700">{c.displayName}</span>
            </label>
          ))}
        </div>
        {selected.length >= 8 && (
          <p className="mt-1 text-xs text-amber-600">Dosažen limit 8 kategorií.</p>
        )}
      </div>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => {
          try { await saveFeaturedCategories(section.id, selected, title || null); toast.success('Uloženo') }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Chyba') }
        })}
        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit'}
      </button>
    </div>
  )
}

// ── Live search produktů ──────────────────────────────────────────

function ProductSearch({ selected, onAdd }: { selected: string[]; onAdd: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await searchProductsForHomepage(query, selected)
        setResults(res)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, selected])

  return (
    <div className="rounded-lg border border-stone-200 overflow-hidden">
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Hledat produkt dle názvu nebo SKU…"
        className="w-full border-b border-stone-200 px-3 py-2 text-sm focus:outline-none" />
      <div className="max-h-44 overflow-y-auto">
        {isSearching && <p className="px-3 py-2 text-xs text-stone-400">Hledám…</p>}
        {!isSearching && query.trim().length >= 2 && results.length === 0 && (
          <p className="px-3 py-2 text-xs text-stone-400">Nic nenalezeno.</p>
        )}
        {!isSearching && query.trim().length < 2 && (
          <p className="px-3 py-2 text-xs text-stone-400">Zadejte alespoň 2 znaky.</p>
        )}
        {results.map((r) => (
          <button key={r.id} onClick={() => { onAdd(r.id, r.name); setQuery('') }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-stone-50 border-b border-stone-50 last:border-0">
            {r.thumbnailUrl && (
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
                <Image src={r.thumbnailUrl} alt="" fill className="object-cover" sizes="32px" unoptimized />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-stone-800">{r.name}</p>
              <p className="text-xs text-stone-400">SKU {r.sku}</p>
            </div>
            {r.isFeatured && <span className="shrink-0 text-xs text-amber-500">★</span>}
            <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">+</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Konfigurace sekce FEATURED_PRODUCTS ──────────────────────────

function FeaturedProductsConfig({ section }: { section: SerializedSection }) {
  const cfg = (section.config as { mode?: string; productIds?: string[]; limit?: number } | null) ?? {}
  const [title, setTitle] = useState(section.title ?? '')
  const [mode, setMode] = useState<FeaturedProductsMode>((cfg.mode as FeaturedProductsMode) ?? 'featured')
  const [productIds, setProductIds] = useState<string[]>(cfg.productIds ?? [])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [limit, setLimit] = useState(cfg.limit ?? 8)
  const [isPending, startTransition] = useTransition()

  function addProduct(id: string, name: string) {
    setProductIds((prev) => prev.includes(id) ? prev : [...prev, id])
    setProductNames((prev) => ({ ...prev, [id]: name }))
  }

  function removeProduct(id: string) {
    setProductIds((prev) => prev.filter((x) => x !== id))
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Nadpis sekce</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="např. Doporučujeme" className={inputCls} />
      </div>

      {/* Mode */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-stone-600">Způsob výběru produktů</p>
        <div className="flex gap-3">
          {(['featured', 'manual'] as FeaturedProductsMode[]).map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name={`mode-${section.id}`} checked={mode === m}
                onChange={() => setMode(m)} className="text-blue-600" />
              <span className="text-sm text-stone-700">
                {m === 'featured' ? 'Automaticky (označené ★)' : 'Ručně vybrané'}
              </span>
            </label>
          ))}
        </div>
        {mode === 'featured' && (
          <p className="mt-1 text-xs text-stone-400">
            Zobrazí produkty označené jako „doporučené" v detailu produktu (záložka Hlavní údaje).
          </p>
        )}
      </div>

      {/* Limit */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-stone-600 whitespace-nowrap">Max. produktů:</label>
        <input type="number" min={1} max={24} value={limit}
          onChange={(e) => setLimit(Math.max(1, Math.min(24, Number(e.target.value))))}
          className="w-20 rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-400" />
      </div>

      {/* Manual selection */}
      {mode === 'manual' && (
        <div className="space-y-2">
          {productIds.length > 0 && (
            <div className="space-y-1">
              {productIds.map((id) => (
                <div key={id} className="flex items-center justify-between rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
                  <span className="text-xs text-stone-700">{productNames[id] ?? id}</span>
                  <button onClick={() => removeProduct(id)}
                    className="text-stone-400 hover:text-red-500 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
          <ProductSearch selected={productIds} onAdd={addProduct} />
        </div>
      )}

      <button
        disabled={isPending}
        onClick={() => startTransition(async () => {
          try {
            await saveFeaturedProducts(section.id, mode, productIds, limit, title || null)
            toast.success('Uloženo')
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Chyba') }
        })}
        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit'}
      </button>
    </div>
  )
}

// ── Konfigurace sekce ABOUT_TEXT ──────────────────────────────────

function AboutTextConfig({ section }: { section: SerializedSection }) {
  const cfg = (section.config as { text?: string } | null) ?? {}
  const [title, setTitle] = useState(section.title ?? '')
  const [text, setText] = useState(cfg.text ?? '')
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Nadpis sekce</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="např. O nás" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Text</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
          placeholder="Krátký text o provozovně…"
          className={`${inputCls} resize-y`} />
      </div>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => {
          try { await saveAboutText(section.id, text, title || null); toast.success('Uloženo') }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Chyba') }
        })}
        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit'}
      </button>
    </div>
  )
}

// ── Sortable karta sekce ──────────────────────────────────────────

function SortableSectionCard({
  section, categories, bannerCounts,
}: {
  section: SerializedSection
  categories: CategoryOption[]
  bannerCounts: Record<string, number>
}) {
  const bannerMeta = BANNER_SECTIONS[section.type]
  const bannerCount = bannerMeta ? (bannerCounts[bannerMeta.placement] ?? 0) : 0
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const [expanded, setExpanded] = useState(true)
  const [toggling, setToggling] = useTransition()

  function handleToggle() {
    setToggling(async () => {
      try { await toggleSectionVisibility(section.id) }
      catch (err) { toast.error(err instanceof Error ? err.message : 'Chyba') }
    })
  }

  return (
    <div ref={setNodeRef} style={style}
      className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <button {...attributes} {...listeners}
          className="cursor-grab p-1 text-stone-300 hover:text-stone-500 active:cursor-grabbing shrink-0"
          title="Přetáhnout">⣿</button>

        <span className="flex-1 text-sm font-semibold text-stone-800">
          {TYPE_LABELS[section.type]}
        </span>

        {bannerMeta && (
          <span className="text-xs text-stone-400">{bannerCount} aktivních bannerů</span>
        )}

        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
            section.isVisible
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}>
          {section.isVisible ? '● Viditelná' : '○ Skrytá'}
        </button>

        <button onClick={() => setExpanded((e) => !e)}
          className="text-stone-400 hover:text-stone-600 text-xs px-1">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Config body */}
      {expanded && (
        <div className="px-4 py-4">
          {section.type === 'CAROUSEL' && <CarouselConfig section={section} />}
          {section.type === 'FEATURED_CATEGORIES' && <FeaturedCategoriesConfig section={section} categories={categories} />}
          {section.type === 'FEATURED_PRODUCTS' && <FeaturedProductsConfig section={section} />}
          {section.type === 'ABOUT_TEXT' && <AboutTextConfig section={section} />}
          {(section.type === 'PROMO_TILES' || section.type === 'MID_BANNER' || section.type === 'FOOTER_CARDS') && (
            <BannerSectionConfig section={section} count={bannerCount} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export function HomepageClient({ sections: initialSections, categories, bannerCounts }: Props) {
  const [sections, setSections] = useState<SerializedSection[]>(initialSections)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id)
      const newIdx = prev.findIndex((s) => s.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx)
      reorderSections(next.map((s) => s.id)).catch(() => toast.error('Chyba při ukládání pořadí'))
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs text-blue-700">
        Pořadí sekcí měňte přetažením. Každou sekci uložte samostatně tlačítkem „Uložit" v sekci.
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sections.map((section) => (
              <SortableSectionCard key={section.id} section={section}
                categories={categories} bannerCounts={bannerCounts} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
