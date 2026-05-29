'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateProductSEO } from './actions'
import type { SerializedProductDetail } from './ProductDetailClient'

interface Props {
  product: SerializedProductDetail
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'
const textareaCls = `${inputCls} resize-y`

function CharCount({ value, max, recommend }: { value: string; max: number; recommend?: string }) {
  const len = value.length
  const over = len > max
  return (
    <span className={`text-xs ${over ? 'text-red-500' : len > max * 0.85 ? 'text-amber-500' : 'text-stone-400'}`}>
      {len}/{max}{recommend ? ` (doporučeno ${recommend})` : ''}
    </span>
  )
}

function JsonLdModal({ product, onClose }: { product: SerializedProductDetail; onClose: () => void }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: product.priceWithVat,
      priceCurrency: 'CZK',
      availability: product.stockStatus === 'IN_STOCK' || product.stockStatus === 'LOW_STOCK'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">Strukturovaná data (JSON-LD)</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>
        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-stone-500">Tato data jsou automaticky generována a vložena do stránky produktu pro Google.</p>
          <pre className="overflow-auto rounded bg-stone-900 p-4 text-xs text-green-300 max-h-64">
            {JSON.stringify(jsonLd, null, 2)}
          </pre>
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

export function AdvancedTab({ product }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showJsonLd, setShowJsonLd] = useState(false)
  const [slugEditable, setSlugEditable] = useState(false)

  const [metaTitle, setMetaTitle] = useState(product.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(product.metaDescription ?? '')
  const [slug, setSlug] = useState(product.slug)
  const [isIndexable, setIsIndexable] = useState(product.isIndexable)

  const googleTitle = metaTitle || product.name
  const googleDesc = metaDescription || product.shortDescription || 'Popis produktu není k dispozici.'

  function handleSlugEdit() {
    if (!slugEditable) {
      if (!confirm('Změna URL adresy rozbije existující odkazy na tento produkt. Chcete pokračovat?')) return
      setSlugEditable(true)
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateProductSEO(product.id, {
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          slug,
          isIndexable,
        })
        toast.success('SEO nastavení uloženo')
        setSlugEditable(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <div className="space-y-6">

      {/* SEO */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-stone-700">SEO — optimalizace pro vyhledávače</h3>
        <div className="space-y-4">

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-stone-700">Meta title</label>
              <CharCount value={metaTitle} max={60} recommend="50–60" />
            </div>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              maxLength={60}
              placeholder={product.name}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-stone-400">Pokud prázdné, použije se název produktu.</p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-stone-700">Meta description</label>
              <CharCount value={metaDescription} max={160} recommend="150–160" />
            </div>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder={product.shortDescription ?? 'Krátký popis pro Google'}
              className={textareaCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">URL adresa (slug)</label>
            <div className="flex items-center gap-2 overflow-hidden rounded border border-stone-300 focus-within:border-blue-400">
              <span className="flex shrink-0 items-center border-r border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-400 whitespace-nowrap">
                branickelahudky.cz/produkty/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                readOnly={!slugEditable}
                className="flex-1 bg-transparent px-2 py-1.5 text-sm font-mono focus:outline-none"
              />
              {!slugEditable && (
                <button onClick={handleSlugEdit}
                  className="shrink-0 border-l border-stone-200 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50">
                  Upravit
                </button>
              )}
            </div>
            {slugEditable && (
              <p className="mt-1 text-xs text-amber-600">⚠ Změna URL rozbije existující odkazy a záložky.</p>
            )}
          </div>

        </div>
      </div>

      {/* Google preview */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-stone-700">Náhled ve vyhledávači</h3>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-0.5 text-xs text-stone-400">branickelahudky.cz › produkty › {slug}</p>
          <p className="text-base font-medium text-blue-700 hover:underline line-clamp-1">
            {googleTitle.slice(0, 60) || '(meta title)'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-stone-500 line-clamp-2">
            {googleDesc.replace(/<[^>]+>/g, '').slice(0, 160) || '(meta description)'}
          </p>
        </div>
      </div>

      {/* Structured data */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-stone-700">Strukturovaná data</h3>
        <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-600">
            Automaticky generujeme structured data (JSON-LD) typu <strong>Product</strong> pro Google.
            Obsahuje: název, popis, cena, dostupnost, fotky.
          </p>
          <button
            onClick={() => setShowJsonLd(true)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Zobrazit JSON-LD →
          </button>
        </div>
      </div>

      {/* Robots */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-stone-700">Indexování</h3>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={isIndexable}
            onChange={(e) => setIsIndexable(e.target.checked)}
            className="rounded"
          />
          <div>
            <span className="text-sm font-medium text-stone-700">Indexovat v Google</span>
            <p className="text-xs text-stone-400">
              Pokud odškrtnete, Google tento produkt neuvidí (meta noindex, nofollow).
            </p>
          </div>
        </label>
      </div>

      {/* URL přesměrování — placeholder */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-700">URL přesměrování</h3>
        <div className="rounded-lg border-2 border-dashed border-stone-200 px-4 py-3 text-center">
          <p className="text-xs text-stone-400">Připravujeme automatické přesměrování při změně URL</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit SEO nastavení'}
      </button>

      {showJsonLd && <JsonLdModal product={product} onClose={() => setShowJsonLd(false)} />}
    </div>
  )
}
