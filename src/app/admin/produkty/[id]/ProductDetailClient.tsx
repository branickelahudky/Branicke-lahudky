'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatCZK, roundMoney } from '@/lib/pricing'
import { updateProduct, deleteProduct, type UpdateProductData } from './actions'
import { PhotoGallery } from './PhotoGallery'
import { CategoryTab } from './CategoryTab'
import { LogisticsTab } from './LogisticsTab'
import { ParametersTab } from './ParametersTab'

// ── Exportované typy (používá page.tsx) ───────────────────────────

export type SerializedProductDetail = {
  id: string
  sku: string
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  priceWithVat: number
  priceWithoutVat: number
  vatRate: number
  salePriceWithVat: number | null
  salePriceWithoutVat: number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
  isWeightBased: boolean
  unit: string
  stockQuantity: number
  stockStatus: string
  trackStock: boolean
  categoryId: string
  categoryPath: string
  isNew: boolean
  isFeatured: boolean
  isOnSale: boolean
  isOnClearance: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  // Logistika
  weightGrams: number | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  storageTemp: string
  shelfLifeDays: number | null
  isFragile: boolean
  // Parametry
  nutritionPer100g: unknown
  allergenCodes: unknown
  allergenInfo: string | null
  ingredients: string | null
  countryOfOrigin: string | null
  producerName: string | null
  producerAddress: string | null
  useByInstructions: string | null
  storageInstructions: string | null
}

export type SerializedProductImage = {
  id: string
  url: string
  thumbnailUrl: string
  storageKey: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
}

export type SerializedCategoryForModal = {
  id: string
  name: string
  slug: string
  children: Array<{ id: string; name: string; slug: string }>
}

// ── FormState ─────────────────────────────────────────────────────

type FormState = {
  name: string
  slug: string
  sku: string
  shortDescription: string
  description: string
  priceWithVat: string
  vatRate: string
  isOnSale: boolean
  salePriceWithVat: string
  saleStartsAt: string
  saleEndsAt: string
  isWeightBased: boolean
  unit: string
  trackStock: boolean
  stockQuantity: string
  stockStatus: string
  categoryId: string
  isNew: boolean
  isFeatured: boolean
  isOnClearance: boolean
  isActive: boolean
}

// ── Konstanty ─────────────────────────────────────────────────────

const TABS = [
  { key: 'hlavni', label: 'Hlavní údaje' },
  { key: 'cenik', label: 'Ceník' },
  { key: 'sklad', label: 'Sklad' },
  { key: 'fotogalerie', label: 'Fotogalerie' },
  { key: 'kategorie', label: 'Kategorie' },
  { key: 'logistika', label: 'Logistika' },
  { key: 'parametry', label: 'Parametry' },
  { key: 'varianty', label: 'Varianty' },
  { key: 'souvisejici', label: 'Související' },
  { key: 'pokrocile', label: 'Pokročilé' },
]

const PLACEHOLDER_TABS = new Set([
  'varianty', 'souvisejici', 'pokrocile',
])

const UNIT_OPTIONS = [
  { value: 'KS', label: 'kus (ks)' },
  { value: 'KG', label: 'kilogram (kg)' },
  { value: 'G_100', label: '100 gramů' },
  { value: 'L', label: 'litr (l)' },
  { value: 'ML_100', label: '100 ml' },
]

const STOCK_STATUS_OPTIONS = [
  { value: 'IN_STOCK', label: 'Skladem' },
  { value: 'LOW_STOCK', label: 'Poslední kusy' },
  { value: 'OUT_OF_STOCK', label: 'Vyprodáno' },
  { value: 'ON_REQUEST', label: 'Na dotaz' },
  { value: 'TEMPORARILY_UNAVAILABLE', label: 'Momentálně nedostupné' },
]

// ── Helpers ───────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildInitialState(p: SerializedProductDetail): FormState {
  return {
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    priceWithVat: String(p.priceWithVat),
    vatRate: String(p.vatRate),
    isOnSale: p.isOnSale,
    salePriceWithVat: p.salePriceWithVat ? String(p.salePriceWithVat) : '',
    saleStartsAt: p.saleStartsAt ?? '',
    saleEndsAt: p.saleEndsAt ?? '',
    isWeightBased: p.isWeightBased,
    unit: p.unit,
    trackStock: p.trackStock,
    stockQuantity: String(p.stockQuantity),
    stockStatus: p.stockStatus,
    categoryId: p.categoryId,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    isOnClearance: p.isOnClearance,
    isActive: p.isActive,
  }
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function ageDays(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'dnes'
  return `${days} dní`
}

// ── Hlavní komponenta ─────────────────────────────────────────────

interface Props {
  product: SerializedProductDetail
  categories: SerializedCategoryForModal[]
  images: SerializedProductImage[]
}

export function ProductDetailClient({ product, categories, images }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState('hlavni')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formState, setFormState] = useState<FormState>(() => buildInitialState(product))
  const [savedState, setSavedState] = useState<FormState>(() => buildInitialState(product))

  // Reset po uložení (server aktualizuje updatedAt)
  useEffect(() => {
    const s = buildInitialState(product)
    setFormState(s)
    setSavedState(s)
  }, [product.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = JSON.stringify(formState) !== JSON.stringify(savedState)

  // beforeunload warning
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Live kalkulace ceny bez DPH
  const priceWithVatNum = parseFloat(formState.priceWithVat) || 0
  const vatRateNum = parseFloat(formState.vatRate) || 0
  const computedPriceWithoutVat =
    vatRateNum > 0 ? roundMoney(priceWithVatNum / (1 + vatRateNum / 100)) : priceWithVatNum

  const salePriceWithVatNum = parseFloat(formState.salePriceWithVat) || 0
  const saleDiscount =
    priceWithVatNum > 0 && salePriceWithVatNum > 0
      ? Math.round((1 - salePriceWithVatNum / priceWithVatNum) * 100)
      : 0

  // Slug auto-suggest: slug stále odpovídá slugify(savedState.name)
  const slugMatchesSaved = savedState.slug === slugify(savedState.name)
  const showSlugSuggest =
    slugMatchesSaved &&
    formState.name !== savedState.name &&
    formState.slug === savedState.slug

  // ── Setters ────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  // ── Validace ───────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!formState.name.trim()) e.name = 'Název je povinný.'
    if (!formState.slug.trim()) e.slug = 'URL adresa je povinná.'
    if (!formState.sku.trim()) e.sku = 'SKU je povinné.'
    const price = parseFloat(formState.priceWithVat)
    if (isNaN(price) || price < 0) e.priceWithVat = 'Cena musí být ≥ 0.'
    if (![0, 12, 21].includes(parseFloat(formState.vatRate))) e.vatRate = 'Neplatná sazba DPH.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Handlery ───────────────────────────────────────────────────

  function buildUpdateData(): UpdateProductData {
    return {
      name: formState.name,
      slug: formState.slug,
      sku: formState.sku,
      shortDescription: formState.shortDescription || null,
      description: formState.description || null,
      priceWithVat: parseFloat(formState.priceWithVat) || 0,
      vatRate: parseFloat(formState.vatRate) || 0,
      isOnSale: formState.isOnSale,
      salePriceWithVat:
        formState.isOnSale && formState.salePriceWithVat
          ? parseFloat(formState.salePriceWithVat)
          : null,
      saleStartsAt: formState.saleStartsAt || null,
      saleEndsAt: formState.saleEndsAt || null,
      isWeightBased: formState.isWeightBased,
      unit: formState.unit,
      trackStock: formState.trackStock,
      stockQuantity: parseInt(formState.stockQuantity) || 0,
      stockStatus: formState.stockStatus,
      categoryId: formState.categoryId,
      isNew: formState.isNew,
      isFeatured: formState.isFeatured,
      isOnClearance: formState.isOnClearance,
      isActive: formState.isActive,
    }
  }

  function handleSave(redirectAfter = false) {
    if (!validate()) {
      toast.error('Opravte chyby ve formuláři.')
      return
    }
    startTransition(async () => {
      try {
        await updateProduct(product.id, buildUpdateData())
        toast.success('Produkt uložen')
        if (redirectAfter) router.push('/admin/produkty')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Opravdu smazat produkt „${product.name}"?\n\nTato akce je nevratná.`,
      )
    )
      return
    startTransition(async () => {
      try {
        await deleteProduct(product.id)
        router.push('/admin/produkty')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při mazání')
      }
    })
  }

  function handleBack() {
    if (isDirty && !window.confirm('Máte neuložené změny. Opravdu chcete odejít?')) return
    router.push('/admin/produkty')
  }


  // ── Sub-komponenty ─────────────────────────────────────────────

  function Field({
    label,
    error,
    hint,
    children,
  }: {
    label: string
    error?: string
    hint?: string
    children: React.ReactNode
  }) {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">{label}</label>
        {children}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {!error && hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
      </div>
    )
  }

  function Toggle({
    label,
    checked,
    onChange,
  }: {
    label: string
    checked: boolean
    onChange: (v: boolean) => void
  }) {
    return (
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm text-stone-700">{label}</span>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            checked ? 'bg-green-500' : 'bg-stone-300'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
    )
  }

  function inputCls(hasError?: boolean) {
    return `w-full rounded border px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${
      hasError ? 'border-red-400' : 'border-stone-300'
    }`
  }

  function PlaceholderTab({ sprint }: { sprint: string }) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-stone-200">
        <div className="text-center text-stone-400">
          <p className="font-medium">Brzy</p>
          <p className="mt-1 text-xs">{sprint}</p>
        </div>
      </div>
    )
  }

  // ── Tab: Hlavní údaje ──────────────────────────────────────────

  function TabHlavni() {
    return (
      <div className="space-y-5">
        <Field label="Název" error={errors.name}>
          <input
            type="text"
            value={formState.name}
            onChange={(e) => setField('name', e.target.value)}
            maxLength={255}
            className={inputCls(!!errors.name)}
          />
        </Field>

        <Field
          label="URL adresa (slug)"
          error={errors.slug}
          hint='Automaticky generovaná z názvu. Změna ovlivní existující odkazy.'
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-1 overflow-hidden rounded border border-stone-300 focus-within:border-blue-400">
              <span className="flex items-center border-r border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-400 whitespace-nowrap">
                branickelahudky.cz/
              </span>
              <input
                type="text"
                value={formState.slug}
                onChange={(e) =>
                  setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                className="flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none font-mono"
              />
            </div>
            {showSlugSuggest && (
              <button
                type="button"
                onClick={() => setField('slug', slugify(formState.name))}
                className="shrink-0 rounded border border-blue-300 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                title="Přepsat URL ze jména"
              >
                ← Přepsat ze jména
              </button>
            )}
          </div>
        </Field>

        <Field label="SKU / Kód" error={errors.sku} hint="Unikátní interní kód produktu">
          <input
            type="text"
            value={formState.sku}
            onChange={(e) => setField('sku', e.target.value)}
            className={`${inputCls(!!errors.sku)} font-mono`}
          />
        </Field>

        <Field label="Krátký popis" hint="Max. 500 znaků. Zobrazuje se v přehledu produktů.">
          <textarea
            value={formState.shortDescription}
            onChange={(e) => setField('shortDescription', e.target.value)}
            maxLength={500}
            rows={3}
            className={inputCls()}
          />
        </Field>

        <Field
          label="Detailní popis"
          hint="Lze použít HTML (tučně: <strong>, odstavce: <p>, seznamy: <ul><li>)."
        >
          <textarea
            value={formState.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={8}
            className={`${inputCls()} font-mono text-xs leading-relaxed`}
          />
        </Field>
      </div>
    )
  }

  // ── Tab: Ceník ─────────────────────────────────────────────────

  function TabCenik() {
    return (
      <div className="space-y-6">
        {/* Ceny */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-stone-700">Základní cena</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cena bez DPH (Kč)" hint="Automaticky přepočítáno">
              <input
                type="text"
                value={formatCZK(computedPriceWithoutVat)}
                disabled
                className="w-full rounded border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-500"
              />
            </Field>

            <Field label="Cena s DPH (Kč)" error={errors.priceWithVat}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formState.priceWithVat}
                onChange={(e) => setField('priceWithVat', e.target.value)}
                className={inputCls(!!errors.priceWithVat)}
              />
            </Field>

            <Field label="Sazba DPH" error={errors.vatRate}>
              <select
                value={formState.vatRate}
                onChange={(e) => setField('vatRate', e.target.value)}
                className={inputCls(!!errors.vatRate)}
              >
                <option value="12">12 % (potraviny)</option>
                <option value="21">21 % (standard)</option>
                <option value="0">0 % (osvobozeno)</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Akční cena */}
        <div className="rounded-lg border border-stone-200 p-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={formState.isOnSale}
              onChange={(e) => setField('isOnSale', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-semibold text-stone-700">Aktivní akční cena</span>
          </label>

          {formState.isOnSale && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Akční cena s DPH (Kč)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formState.salePriceWithVat}
                    onChange={(e) => setField('salePriceWithVat', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <div className="flex items-end pb-1.5">
                  {saleDiscount > 0 && (
                    <p className="text-sm font-medium text-green-700">
                      Sleva: −{formatCZK(priceWithVatNum - salePriceWithVatNum)} ({saleDiscount} %)
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Platí od" hint="Volitelné">
                  <input
                    type="date"
                    value={formState.saleStartsAt}
                    onChange={(e) => setField('saleStartsAt', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="Platí do" hint="Volitelné">
                  <input
                    type="date"
                    value={formState.saleEndsAt}
                    onChange={(e) => setField('saleEndsAt', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* Váhový režim */}
        <div className="rounded-lg border border-stone-200 p-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={formState.isWeightBased}
              onChange={(e) => setField('isWeightBased', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-semibold text-stone-700">
              Cena za jednotku váhy (váhový produkt)
            </span>
          </label>

          {formState.isWeightBased && (
            <div className="mt-4">
              <Field label="Jednotka" hint="Za jakou jednotku platí zadaná cena">
                <select
                  value={formState.unit}
                  onChange={(e) => setField('unit', e.target.value)}
                  className={inputCls()}
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="mt-2 text-xs text-blue-600">
                Finální cena se přepočítá podle navážení v objednávce.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tab: Sklad ─────────────────────────────────────────────────

  function TabSklad() {
    return (
      <div className="space-y-5">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={formState.trackStock}
            onChange={(e) => setField('trackStock', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-semibold text-stone-700">Sledovat skladové zásoby</span>
        </label>

        {formState.trackStock && (
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Aktuální množství"
              hint="Počet kusů na skladě"
            >
              <input
                type="number"
                min="0"
                step="1"
                value={formState.stockQuantity}
                onChange={(e) => setField('stockQuantity', e.target.value)}
                className={inputCls()}
              />
            </Field>
          </div>
        )}

        <Field
          label="Stav skladu"
          hint="Stav se automaticky nastaví podle množství, nebo můžete přepsat ručně."
        >
          <select
            value={formState.stockStatus}
            onChange={(e) => setField('stockStatus', e.target.value)}
            className={inputCls()}
          >
            {STOCK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    )
  }


  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={`flex flex-1 flex-col transition-opacity ${isPending ? 'opacity-60' : ''}`}>

      {/* Sticky akční lišta */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            ← Zpět
          </button>
          <h2 className="text-sm font-semibold text-stone-500">
            {isDirty && (
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" title="Neuložené změny" />
            )}
            {product.name}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled
            title="Brzy k dispozici"
            className="cursor-not-allowed rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-400"
          >
            Zkopírovat
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Smazat
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isPending}
            className="rounded border border-green-500 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-40"
          >
            Uložit a odejít
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isPending || !isDirty}
            className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            {isPending ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>

      {/* Hlavní obsah */}
      <div className="flex flex-1 gap-6 p-6 overflow-y-auto">

        {/* Levá část: záložky */}
        <div className="min-w-0 flex-1">
          <div className="rounded-lg border border-stone-200 bg-white">

            {/* Tab lišta */}
            <div className="flex overflow-x-auto border-b border-stone-200">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative whitespace-nowrap px-4 py-3 text-sm transition ${
                    activeTab === tab.key
                      ? 'font-semibold text-stone-900'
                      : 'text-stone-500 hover:text-stone-700'
                  } ${PLACEHOLDER_TABS.has(tab.key) ? 'text-stone-400' : ''}`}
                >
                  {activeTab === tab.key && (
                    <span className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-blue-500" />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab obsah */}
            <div className="p-6">
              {activeTab === 'hlavni' && <TabHlavni />}
              {activeTab === 'cenik' && <TabCenik />}
              {activeTab === 'sklad' && <TabSklad />}
              {activeTab === 'kategorie' && (
                <CategoryTab
                  productId={product.id}
                  currentCategoryId={product.categoryId}
                  categories={categories}
                />
              )}
              {activeTab === 'logistika' && <LogisticsTab product={product} />}
              {activeTab === 'parametry' && <ParametersTab product={product} />}
              {activeTab === 'fotogalerie' && <PhotoGallery productId={product.id} initialImages={images} />}
              {activeTab === 'varianty' && <PlaceholderTab sprint="Sprint 3-2d" />}
              {activeTab === 'souvisejici' && <PlaceholderTab sprint="Sprint 3-2d" />}
              {activeTab === 'pokrocile' && <PlaceholderTab sprint="Sprint 3-2d" />}
            </div>
          </div>
        </div>

        {/* Pravý sticky panel */}
        <div className="w-64 shrink-0">
          <div className="sticky top-16 space-y-4">

            {/* Příznaky */}
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Příznaky
              </p>
              <div className="space-y-3">
                <Toggle
                  label="Viditelnost"
                  checked={formState.isActive}
                  onChange={(v) => setField('isActive', v)}
                />
                <Toggle
                  label="Akce"
                  checked={formState.isOnSale}
                  onChange={(v) => setField('isOnSale', v)}
                />
                <Toggle
                  label="Novinka"
                  checked={formState.isNew}
                  onChange={(v) => setField('isNew', v)}
                />
                <Toggle
                  label="Tip"
                  checked={formState.isFeatured}
                  onChange={(v) => setField('isFeatured', v)}
                />
                <Toggle
                  label="Výprodej"
                  checked={formState.isOnClearance}
                  onChange={(v) => setField('isOnClearance', v)}
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Metadata
              </p>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-stone-400">Vytvořeno</dt>
                  <dd className="text-stone-700">{fmtDate(product.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-stone-400">Naposledy upraveno</dt>
                  <dd className="text-stone-700">{fmtDate(product.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-stone-400">Stáří</dt>
                  <dd className="text-stone-700">{ageDays(product.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-stone-400">SKU</dt>
                  <dd className="font-mono text-stone-700">{product.sku}</dd>
                </div>
              </dl>
            </div>

            {/* Cena preview */}
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Cena
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Bez DPH</span>
                  <span className="font-medium">{formatCZK(computedPriceWithoutVat)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">S DPH</span>
                  <span className="font-semibold text-stone-900">
                    {formatCZK(priceWithVatNum)}
                  </span>
                </div>
                {formState.isOnSale && salePriceWithVatNum > 0 && (
                  <div className="mt-2 rounded bg-green-50 p-2">
                    <div className="flex justify-between text-xs text-green-700">
                      <span>Akční cena</span>
                      <span className="font-semibold">{formatCZK(salePriceWithVatNum)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}
