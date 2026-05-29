'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { applyFormat } from '@/lib/number-format'
import { updateNumberSeries, type SerializedSeries, type NumberSeriesUpdateData } from './actions'

interface Props {
  initialSeries: SerializedSeries[]
  isOwner: boolean
}

// ─── Format preview (pure, client-side) ──────────────────────────

function previewFormat(format: string, year: number, num: number): string {
  try {
    return applyFormat(format, year, num)
  } catch {
    return '(chyba formátu)'
  }
}

// ─── EditModal ────────────────────────────────────────────────────

function EditModal({
  series,
  onSave,
  onClose,
}: {
  series: SerializedSeries
  onSave: (id: string, data: NumberSeriesUpdateData) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<NumberSeriesUpdateData>({
    name: series.name,
    format: series.format,
    currentYear: series.currentYear,
    currentNumber: series.currentNumber,
    yearlyReset: series.yearlyReset,
    isActive: series.isActive,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [counterWarning, setCounterWarning] = useState(false)

  const set = <K extends keyof NumberSeriesUpdateData>(key: K, value: NumberSeriesUpdateData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  const nowYear = new Date().getFullYear()
  const previewYear = form.yearlyReset && form.currentYear < nowYear ? nowYear : form.currentYear
  const previewNum = form.currentNumber + 1
  const preview = previewFormat(form.format, previewYear, previewNum)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await onSave(series.id, form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba.')
    } finally {
      setSaving(false)
    }
  }

  function handleCounterChange(val: number) {
    if (val !== series.currentNumber && !counterWarning) {
      const ok = window.confirm(
        'Manuální změna čítače může vést k duplikátním číslům.\n\nPokračovat?',
      )
      if (!ok) return
      setCounterWarning(true)
    }
    set('currentNumber', val)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h3 className="font-semibold text-stone-900">Upravit číselnou řadu — {series.key}</h3>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-stone-700">Název</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-stone-700">Formát</label>
            <input
              value={form.format}
              onChange={(e) => set('format', e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
              placeholder="{rok}-{poradi:3}"
            />
            <p className="text-xs text-stone-400">
              Placeholdery: <code className="rounded bg-stone-100 px-1">{'{rok}'}</code>=2026,{' '}
              <code className="rounded bg-stone-100 px-1">{'{rok2}'}</code>=26,{' '}
              <code className="rounded bg-stone-100 px-1">{'{poradi:3}'}</code>=001,{' '}
              <code className="rounded bg-stone-100 px-1">{'{poradi}'}</code>=1
            </p>
            <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              Náhled dalšího čísla: <span className="font-mono">{preview}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-stone-700">Aktuální rok</label>
              <input
                type="number"
                min={2020}
                max={2099}
                value={form.currentYear}
                onChange={(e) => set('currentYear', parseInt(e.target.value) || nowYear)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-stone-700">Aktuální čítač</label>
              <input
                type="number"
                min={0}
                value={form.currentNumber}
                onChange={(e) => handleCounterChange(parseInt(e.target.value) || 0)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-stone-400">Další vydané číslo bude: {previewNum}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.yearlyReset}
                onChange={(e) => set('yearlyReset', e.target.checked)}
                className="size-4 rounded border-stone-300 accent-amber-500"
              />
              Restart čítače 1. ledna
            </label>

            <button
              onClick={() => set('isActive', !form.isActive)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.isActive ? 'bg-green-500' : 'bg-stone-200'
              }`}
              role="switch"
              aria-checked={form.isActive}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  form.isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-stone-600">{form.isActive ? 'Aktivní' : 'Neaktivní'}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
          >
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CiselneRadyClient ────────────────────────────────────────────

export function CiselneRadyClient({ initialSeries, isOwner }: Props) {
  const [series, setSeries] = useState<SerializedSeries[]>(initialSeries)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingSeries = series.find((s) => s.id === editingId) ?? null

  async function handleSave(id: string, data: NumberSeriesUpdateData) {
    await updateNumberSeries(id, data)
    setSeries((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, ...data }
          : s,
      ),
    )
    toast.success('Číselná řada uložena.')
  }

  const nowYear = new Date().getFullYear()

  function getNextPreview(s: SerializedSeries): string {
    const year = s.yearlyReset && s.currentYear < nowYear ? nowYear : s.currentYear
    return previewFormat(s.format, year, s.currentNumber + 1)
  }

  return (
    <div className="flex flex-col">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <h2 className="text-sm font-medium text-stone-700">Číselné řady</h2>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
        <p className="text-sm text-stone-500">
          Formát a čítač čísel faktur, objednávek a dokladů. Změna formátu se projeví pouze u nově vytvořených záznamů.
        </p>

        {/* Warning box */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Pozor:</strong> Číselná řada by se neměla měnit po spuštění ostrého provozu — kvůli kontinuitě účetnictví. Manuální úpravy čítače mohou vést k duplikátním číslům.
          {!isOwner && (
            <span className="ml-1 font-medium">Úpravy jsou dostupné pouze pro majitele.</span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-4 py-3 text-left">Název</th>
                <th className="px-4 py-3 text-left font-mono">Formát</th>
                <th className="px-4 py-3 text-center">Rok</th>
                <th className="px-4 py-3 text-left">Další číslo</th>
                <th className="px-4 py-3 text-center">Reset 1.1.</th>
                <th className="px-4 py-3 text-center">Aktivní</th>
                {isOwner && <th className="px-4 py-3 text-right" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {series.map((s) => (
                <tr key={s.id} className={s.isActive ? 'bg-white' : 'bg-stone-50 text-stone-400'}>
                  <td className="px-4 py-3 font-medium text-stone-800">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-600">{s.format}</td>
                  <td className="px-4 py-3 text-center text-stone-600">{s.currentYear}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-700">
                      {getNextPreview(s)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.yearlyReset ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block size-2 rounded-full ${
                        s.isActive ? 'bg-green-500' : 'bg-stone-300'
                      }`}
                    />
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingId(s.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Upravit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingSeries && (
        <EditModal
          series={editingSeries}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
