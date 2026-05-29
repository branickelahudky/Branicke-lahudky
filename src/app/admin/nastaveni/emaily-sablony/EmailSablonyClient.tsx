'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateBrandSettings, sendPreviewEmail, type BrandSettingsData } from './actions'

interface Props {
  initialBrand: BrandSettingsData
  initialPreviewHtml: string
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-stone-700">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-16 cursor-pointer rounded border border-stone-300 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
          }}
          maxLength={7}
          className="w-28 rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
          placeholder="#C9A961"
        />
        <span
          className="inline-block h-8 w-8 rounded border border-stone-200 shadow-sm"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  )
}

export function EmailSablonyClient({ initialBrand, initialPreviewHtml }: Props) {
  const [brand, setBrand] = useState<BrandSettingsData>(initialBrand)
  const [savedBrand, setSavedBrand] = useState<BrandSettingsData>(initialBrand)
  const [saving, setSaving] = useState(false)
  const [isSending, startSending] = useTransition()
  const [error, setError] = useState('')

  const isDirty = JSON.stringify(brand) !== JSON.stringify(savedBrand)

  function set(key: keyof BrandSettingsData, value: string) {
    setBrand((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateBrandSettings(brand)
      setSavedBrand({ ...brand })
      toast.success('Brand barvy uloženy. Při příštím odeslání emailu se projeví nové barvy.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba.')
    } finally {
      setSaving(false)
    }
  }

  function handleSendTest() {
    startSending(async () => {
      try {
        const result = await sendPreviewEmail()
        if (result.success) {
          toast.success('Testovací email odeslán na tvůj email.')
        } else {
          toast.error(`Email se nepodařilo odeslat: ${result.error ?? 'neznámá chyba'}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Neznámá chyba.')
      }
    })
  }

  return (
    <div className="flex flex-col">
      {/* Sticky bar */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <h2 className="text-sm font-medium text-stone-700">Vzhled e-mailů</h2>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-6">
        {/* Info */}
        <div>
          <p className="text-sm text-stone-500">
            Jednotná šablona pro všechny automatické emaily (potvrzení objednávky, změny stavu, faktura, …).
            Texty jednotlivých emailů upravujete ve{' '}
            <a href="/admin/nastaveni/stavy-objednavek" className="text-amber-600 hover:underline">
              Stavech objednávek
            </a>
            .
          </p>
        </div>

        {/* Brand colors */}
        <div className="rounded-lg border border-stone-200 bg-white p-6">
          <h3 className="mb-4 border-b border-stone-100 pb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Barvy šablony
          </h3>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <ColorField
              label="Hlavní barva (zlatá)"
              value={brand.primaryColor}
              onChange={(v) => set('primaryColor', v)}
            />
            <ColorField
              label="Tmavá barva (černá)"
              value={brand.darkColor}
              onChange={(v) => set('darkColor', v)}
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {saving ? 'Ukládám…' : 'Uložit barvy'}
            </button>
            {isDirty && (
              <button
                onClick={() => { setBrand({ ...savedBrand }); setError('') }}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Zahodit
              </button>
            )}
            <p className="text-xs text-stone-400">
              Změna se projeví u nově odeslaných emailů.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
            <div>
              <h3 className="text-sm font-semibold text-stone-800">Náhled emailu</h3>
              <p className="mt-0.5 text-xs text-stone-400">
                Zobrazuje aktuálně uložené barvy. Náhled se obnoví po reloadu stránky.
              </p>
            </div>
            <button
              onClick={handleSendTest}
              disabled={isSending}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {isSending ? 'Odesílám…' : 'Odeslat testovací email'}
            </button>
          </div>
          <div className="overflow-hidden rounded-b-lg bg-stone-100 p-4">
            <iframe
              srcDoc={initialPreviewHtml}
              title="Náhled emailu"
              className="h-[780px] w-full rounded border-0 bg-white shadow-sm"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
