'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateCategorySEO } from './actions'

export type SerializedCategorySeo = {
  id: string
  name: string
  slug: string
  depth: number
  description: string | null
  metaTitle: string | null
  metaDescription: string | null
  productCount: number
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'
const textareaCls = inputCls + ' resize-y'

function CharCount({ value, max, recommend }: { value: string; max: number; recommend?: string }) {
  const len = value.length
  const over = len > max
  return (
    <span className={`text-xs ${over ? 'text-red-500' : len > max * 0.85 ? 'text-amber-500' : 'text-stone-400'}`}>
      {len}/{max}{recommend ? ` (doporučeno ${recommend})` : ''}
    </span>
  )
}

// ── Modal editace SEO jedné kategorie ─────────────────────────────

function SeoModal({ category, onClose }: { category: SerializedCategorySeo; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [metaTitle, setMetaTitle] = useState(category.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(category.metaDescription ?? '')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const googleTitle = metaTitle || category.name
  const googleDesc =
    metaDescription ||
    category.description ||
    `${category.name} z nabídky Branického lahůdkářství — rodinného řeznictví a lahůdkářství v Praze 4.`

  function handleSave() {
    startTransition(async () => {
      try {
        await updateCategorySEO(category.id, {
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
        })
        toast.success('SEO kategorie uloženo')
        router.refresh()
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-semibold text-stone-900">SEO — {category.name}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>

        <div className="space-y-4 px-5 py-4">
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
              placeholder={category.name}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-stone-400">Pokud prázdné, použije se název kategorie.</p>
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
              placeholder="Krátký popis kategorie pro Google"
              className={textareaCls}
            />
          </div>

          {/* Náhled ve vyhledávači */}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-stone-700">Náhled ve vyhledávači</h4>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="mb-0.5 text-xs text-stone-400">lahudkybranik.cz › kategorie › {category.slug}</p>
              <p className="text-base font-medium text-blue-700 hover:underline line-clamp-1">
                {googleTitle.slice(0, 60)}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500 line-clamp-2">
                {googleDesc.replace(/<[^>]+>/g, '').slice(0, 160)}
              </p>
            </div>
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
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            {isPending ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Seznam kategorií ──────────────────────────────────────────────

export function CategoriesSeoClient({ categories }: { categories: SerializedCategorySeo[] }) {
  const [editing, setEditing] = useState<SerializedCategorySeo | null>(null)

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase text-stone-500">
              <th className="px-4 py-2 font-medium">Kategorie</th>
              <th className="px-4 py-2 font-medium">Meta title</th>
              <th className="px-4 py-2 font-medium">Meta description</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <td className="px-4 py-2">
                  <span className={cat.depth ? 'pl-5 text-stone-600' : 'font-medium text-stone-800'}>
                    {cat.depth ? '↳ ' : ''}{cat.name}
                  </span>
                  <span className="ml-2 text-xs text-stone-400">({cat.productCount})</span>
                </td>
                <td className="max-w-[180px] truncate px-4 py-2 text-stone-500">
                  {cat.metaTitle || <span className="italic text-stone-300">automaticky</span>}
                </td>
                <td className="max-w-[220px] truncate px-4 py-2 text-stone-500">
                  {cat.metaDescription || <span className="italic text-stone-300">automaticky</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <a
                    href={`/kategorie/${cat.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Zobrazit kategorii na webu"
                    className="mr-3 text-xs text-stone-500 hover:text-blue-600 hover:underline"
                  >
                    Zobrazit na webu ↗
                  </a>
                  <button
                    onClick={() => setEditing(cat)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Upravit SEO
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <SeoModal category={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
