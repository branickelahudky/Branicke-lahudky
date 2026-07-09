'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { updateSeoSettings, deleteSeoOgImage, type SeoFormData } from './actions'

export type SerializedSeoSettings = {
  siteTitle: string
  titleTemplate: string
  metaDescription: string | null
  ogImageUrl: string | null
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'
const textareaCls = inputCls + ' resize-y'
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5

function CharCount({ value, max, recommend }: { value: string; max: number; recommend?: string }) {
  const len = value.length
  const over = len > max
  return (
    <span className={`text-xs ${over ? 'text-red-500' : len > max * 0.85 ? 'text-amber-500' : 'text-stone-400'}`}>
      {len}/{max}{recommend ? ` (doporučeno ${recommend})` : ''}
    </span>
  )
}

// ── Upload widget pro OG obrázek ──────────────────────────────────

function OgImageUpload({
  currentUrl,
  onUploaded,
  onDeleted,
}: {
  currentUrl: string | null
  onUploaded: (url: string) => void
  onDeleted: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error('Povolené formáty: JPG, PNG, WebP')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Soubor je příliš velký (max ${MAX_MB} MB)`)
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/admin/seo/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chyba při nahrávání')

      onUploaded(data.url)
      toast.success('OG obrázek nahrán')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!confirm('Smazat OG obrázek?')) return
    setDeleting(true)
    try {
      await deleteSeoOgImage()
      onDeleted()
      toast.success('OG obrázek smazán')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="relative h-[63px] w-[120px] shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-50">
        {currentUrl ? (
          <Image src={currentUrl} alt="OG obrázek" fill className="object-cover" sizes="120px" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-stone-400">1200 × 630</div>
        )}
      </div>
      <div className="flex-1">
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`cursor-pointer rounded border-2 border-dashed px-4 py-3 text-center text-xs transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-stone-300 text-stone-500 hover:border-stone-400'
          } ${uploading ? 'cursor-wait opacity-60' : ''}`}
        >
          {uploading ? 'Nahrávám…' : 'Klikněte nebo přetáhněte obrázek (JPG/PNG/WebP, ořízne se na 1200×630)'}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(',')}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
        />
        {currentUrl && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-40"
          >
            {deleting ? 'Mažu…' : 'Smazat obrázek'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Hlavní formulář ───────────────────────────────────────────────

export function SeoClient({ settings }: { settings: SerializedSeoSettings }) {
  const [isPending, startTransition] = useTransition()

  const [siteTitle, setSiteTitle] = useState(settings.siteTitle)
  const [titleTemplate, setTitleTemplate] = useState(settings.titleTemplate)
  const [metaDescription, setMetaDescription] = useState(settings.metaDescription ?? '')
  const [ogImageUrl, setOgImageUrl] = useState(settings.ogImageUrl)

  const exampleTitle = titleTemplate.includes('%s')
    ? titleTemplate.replace('%s', 'Uzeniny')
    : titleTemplate || 'Uzeniny'

  function handleSave() {
    startTransition(async () => {
      try {
        const data: SeoFormData = {
          siteTitle,
          titleTemplate,
          metaDescription: metaDescription || null,
        }
        await updateSeoSettings(data)
        toast.success('SEO nastavení uloženo')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <div className="space-y-6">

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-stone-700">Název webu (výchozí titulek)</label>
          <CharCount value={siteTitle} max={60} recommend="50–60" />
        </div>
        <input
          type="text"
          value={siteTitle}
          onChange={(e) => setSiteTitle(e.target.value)}
          maxLength={90}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-stone-400">Titulek homepage a stránek bez vlastního titulku.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Šablona titulku podstránek</label>
        <input
          type="text"
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.target.value)}
          maxLength={90}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-stone-400">
          %s se nahradí názvem stránky — např. „{exampleTitle}&#8220;.
        </p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-stone-700">Meta description webu</label>
          <CharCount value={metaDescription} max={160} recommend="150–160" />
        </div>
        <textarea
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          maxLength={200}
          rows={3}
          className={textareaCls}
          placeholder="Popis webu pro Google a sociální sítě"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-stone-700">Výchozí obrázek pro sociální sítě (OpenGraph)</label>
        <OgImageUpload
          currentUrl={ogImageUrl}
          onUploaded={(url) => setOgImageUrl(url)}
          onDeleted={() => setOgImageUrl(null)}
        />
        <p className="mt-2 text-xs text-stone-400">
          Zobrazí se při sdílení webu na Facebooku a dalších sítích. Produkty používají vlastní fotku.
        </p>
      </div>

      {/* Náhled ve vyhledávači */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-700">Náhled ve vyhledávači (homepage)</h3>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-0.5 text-xs text-stone-400">lahudkybranik.cz</p>
          <p className="text-base font-medium text-blue-700 hover:underline line-clamp-1">
            {siteTitle.slice(0, 60) || '(název webu)'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-stone-500 line-clamp-2">
            {metaDescription.slice(0, 160) || '(meta description)'}
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit SEO nastavení'}
      </button>
    </div>
  )
}
