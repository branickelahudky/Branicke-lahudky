'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateCookieSettings, type CookieFormData } from './actions'

export type SerializedCookieSettings = {
  enabled: boolean
  bannerTitle: string
  bannerText: string | null
  acceptAllLabel: string
  rejectLabel: string
  policyPageId: string | null
}

export type SerializedPageOption = {
  id: string
  title: string
  slug: string
}

interface Props {
  settings: SerializedCookieSettings
  pages: SerializedPageOption[]
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'

// ── Statický náhled lišty ─────────────────────────────────────────

function BannerPreview({
  title, text, acceptLabel, rejectLabel, policyPage,
}: {
  title: string
  text: string | null
  acceptLabel: string
  rejectLabel: string
  policyPage: SerializedPageOption | null
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
      <div className="border-b border-stone-100 bg-stone-50 px-3 py-1.5 flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-red-300" />
        <span className="h-3 w-3 rounded-full bg-amber-300" />
        <span className="h-3 w-3 rounded-full bg-green-300" />
        <span className="ml-2 text-xs text-stone-400">Náhled webu</span>
      </div>
      <div className="relative h-36 bg-stone-100 overflow-hidden">
        {/* Simulace obsahu stránky */}
        <div className="p-4 space-y-1.5 opacity-30">
          <div className="h-3 w-32 rounded bg-stone-400" />
          <div className="h-2 w-full rounded bg-stone-300" />
          <div className="h-2 w-3/4 rounded bg-stone-300" />
          <div className="h-2 w-5/6 rounded bg-stone-300" />
        </div>

        {/* Cookies lišta */}
        <div className="absolute inset-x-0 bottom-0 bg-stone-800 text-white px-4 py-3">
          <p className="text-xs font-semibold mb-1">{title || 'Používáme cookies'}</p>
          {text && (
            <p className="text-xs text-stone-300 leading-relaxed line-clamp-2 mb-2">{text}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button className="rounded bg-green-500 px-3 py-1 text-xs font-medium text-white">
              {acceptLabel || 'Přijmout vše'}
            </button>
            <button className="rounded border border-stone-500 px-3 py-1 text-xs text-stone-300">
              {rejectLabel || 'Odmítnout'}
            </button>
            {policyPage && (
              <span className="text-xs text-stone-400 underline cursor-pointer">
                {policyPage.title}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-green-500' : 'bg-stone-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
      <span className="text-sm font-medium text-stone-700">{label}</span>
    </label>
  )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export function CookiesClient({ settings: initial, pages }: Props) {
  const [isPending, startTransition] = useTransition()

  const [enabled, setEnabled] = useState(initial.enabled)
  const [bannerTitle, setBannerTitle] = useState(initial.bannerTitle)
  const [bannerText, setBannerText] = useState(initial.bannerText ?? '')
  const [acceptAllLabel, setAcceptAllLabel] = useState(initial.acceptAllLabel)
  const [rejectLabel, setRejectLabel] = useState(initial.rejectLabel)
  const [policyPageId, setPolicyPageId] = useState(initial.policyPageId ?? '')

  const selectedPage = pages.find((p) => p.id === policyPageId) ?? null

  function handleSave() {
    const data: CookieFormData = {
      enabled,
      bannerTitle,
      bannerText: bannerText || null,
      acceptAllLabel,
      rejectLabel,
      policyPageId: policyPageId || null,
    }
    startTransition(async () => {
      try {
        await updateCookieSettings(data)
        toast.success('Nastavení cookies uloženo')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <div className={`space-y-5 transition-opacity ${isPending ? 'opacity-60' : ''}`}>

      {/* Zapnutí lišty */}
      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          label="Zobrazovat cookies lištu na webu"
        />
        {!enabled && (
          <p className="mt-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Lišta je vypnutá — návštěvníci webu ji neuvidí.
          </p>
        )}
      </div>

      {/* Texty */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold text-stone-700">Texty lišty</h3>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Titulek lišty</label>
          <input type="text" value={bannerTitle}
            onChange={(e) => setBannerTitle(e.target.value)}
            className={inputCls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Vysvětlující text</label>
          <textarea value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            rows={3}
            placeholder="Tento web používá cookies pro zajištění správné funkce…"
            className={`${inputCls} resize-y`} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Tlačítko souhlasu</label>
            <input type="text" value={acceptAllLabel}
              onChange={(e) => setAcceptAllLabel(e.target.value)}
              className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Tlačítko odmítnutí</label>
            <input type="text" value={rejectLabel}
              onChange={(e) => setRejectLabel(e.target.value)}
              className={inputCls} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Stránka se zásadami cookies
          </label>
          <select value={policyPageId} onChange={(e) => setPolicyPageId(e.target.value)}
            className={inputCls}>
            <option value="">— Nevybráno —</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-400">
            Odkaz na tuto stránku se zobrazí v liště jako „Více informací".
          </p>
        </div>
      </div>

      {/* Náhled */}
      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-stone-700">Náhled lišty</h3>
        <BannerPreview
          title={bannerTitle}
          text={bannerText || null}
          acceptLabel={acceptAllLabel}
          rejectLabel={rejectLabel}
          policyPage={selectedPage}
        />
        <p className="mt-2 text-xs text-stone-400">
          Toto je přibližný náhled — finální vzhled závisí na designu webu.
        </p>
      </div>

      {/* Uložit */}
      <button onClick={handleSave} disabled={isPending}
        className="rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40">
        {isPending ? 'Ukládám…' : 'Uložit nastavení'}
      </button>

    </div>
  )
}
