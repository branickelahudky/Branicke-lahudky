'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RichEditor } from './RichEditor'
import { updatePage, togglePublished, deletePage, type PageFormData } from '../actions'

type PageData = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  isPublished: boolean
  isSystem: boolean
  metaTitle: string | null
  metaDescription: string | null
  robotsIndex: boolean
}

interface Props {
  page: PageData
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function CharCount({ value, max, recommend }: { value: string; max: number; recommend?: string }) {
  const len = value.length
  const over = len > max
  return (
    <span className={`text-xs ${over ? 'text-red-500' : len > max * 0.85 ? 'text-amber-500' : 'text-stone-400'}`}>
      {len}/{max}{recommend ? ` (doporučeno ${recommend})` : ''}
    </span>
  )
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'

export function PageEditor({ page }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const [slugManual, setSlugManual] = useState(false)
  const [excerpt, setExcerpt] = useState(page.excerpt ?? '')
  const [content, setContent] = useState(page.content ?? '')
  const [metaTitle, setMetaTitle] = useState(page.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(page.metaDescription ?? '')
  const [robotsIndex, setRobotsIndex] = useState(page.robotsIndex)
  const [isPublished, setIsPublished] = useState(page.isPublished)

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!slugManual) setSlug(slugify(val))
  }

  function buildData(): PageFormData {
    return {
      title,
      slug,
      excerpt: excerpt || null,
      content: content || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      robotsIndex,
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updatePage(page.id, buildData())
        toast.success('Stránka uložena')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  function handleTogglePublished() {
    startTransition(async () => {
      try {
        await togglePublished(page.id)
        setIsPublished((p) => !p)
        toast.success(isPublished ? 'Stránka skryta' : 'Stránka publikována')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Opravdu smazat stránku „${title}"? Tato akce je nevratná.`)) return
    startTransition(async () => {
      try {
        await deletePage(page.id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba')
      }
    })
  }

  return (
    <div className={`flex flex-1 flex-col transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/vzhled/stranky')}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            ← Zpět
          </button>
          <h2 className="text-sm font-semibold text-stone-500 truncate max-w-xs">{title || 'Nová stránka'}</h2>
        </div>
        <div className="flex items-center gap-2">
          {!page.isSystem && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Smazat
            </button>
          )}
          <button
            onClick={handleTogglePublished}
            disabled={isPending}
            className={`rounded border px-3 py-1.5 text-sm disabled:opacity-40 ${
              isPublished
                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                : 'border-green-400 text-green-700 hover:bg-green-50'
            }`}
          >
            {isPublished ? 'Skrýt' : 'Publikovat'}
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            {isPending ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-6 overflow-y-auto p-6">
        <div className="min-w-0 flex-1 space-y-5">

          {/* Základní pole */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Název *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className={inputCls}
                placeholder="Název stránky"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Slug (URL)</label>
              <div className="flex items-center gap-0 overflow-hidden rounded border border-stone-300 focus-within:border-blue-400">
                <span className="shrink-0 border-r border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-400">
                  branickelahudky.cz/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }}
                  className="flex-1 bg-transparent px-2 py-1.5 text-sm font-mono focus:outline-none"
                />
              </div>
              {!slugManual && (
                <p className="mt-1 text-xs text-stone-400">Automaticky generován z názvu.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Krátký popis (excerpt)</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                placeholder="Volitelný krátký popis stránky"
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Obsah */}
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <label className="mb-2 block text-sm font-medium text-stone-700">Obsah stránky</label>
            <RichEditor content={content} onChange={setContent} />
          </div>

          {/* SEO */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-stone-700">SEO</h3>

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
                placeholder={title}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-stone-400">Pokud prázdné, použije se název stránky.</p>
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
                className={`${inputCls} resize-y`}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={robotsIndex}
                onChange={(e) => setRobotsIndex(e.target.checked)}
                className="rounded"
              />
              <div>
                <span className="text-sm font-medium text-stone-700">Indexovat v Google</span>
                <p className="text-xs text-stone-400">
                  Pokud odškrtnete, Google tuto stránku neuvidí (meta noindex).
                </p>
              </div>
            </label>

            {/* Google preview */}
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="mb-1 text-xs text-stone-400">Náhled ve vyhledávači</p>
              <p className="text-xs text-stone-400">branickelahudky.cz › {slug}</p>
              <p className="text-sm font-medium text-blue-700 line-clamp-1">
                {(metaTitle || title) || '(meta title)'}
              </p>
              <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">
                {(metaDescription || excerpt) || '(meta description)'}
              </p>
            </div>
          </div>

        </div>

        {/* Pravý panel */}
        <div className="w-56 shrink-0">
          <div className="sticky top-16 space-y-4">
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Stav</p>
              <div className={`mb-3 flex items-center gap-2 text-sm font-medium ${isPublished ? 'text-green-700' : 'text-stone-500'}`}>
                <span className={`h-2 w-2 rounded-full ${isPublished ? 'bg-green-500' : 'bg-stone-300'}`} />
                {isPublished ? 'Publikováno' : 'Skryto'}
              </div>
              {page.isSystem && (
                <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                  Systémová stránka
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
