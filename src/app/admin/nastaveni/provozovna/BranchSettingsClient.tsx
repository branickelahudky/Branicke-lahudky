'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { updateBranchSettings, type BranchSettingsData } from './actions'

interface Props {
  initial: BranchSettingsData
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-stone-200 pb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
      {children}
    </h3>
  )
}

function inputCls() {
  return 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400'
}

const DEFAULTS: BranchSettingsData = {
  name: 'Branické lahůdkářství',
  street: 'Branická 75',
  zip: '14000',
  city: 'Praha',
  country: 'Česká republika',
  email: 'info@lahudkybranik.cz',
  phone1: '731 862 387',
  phone2: '775 182 396',
  managerName: 'Lubomír Markes',
  openingHours: 'Po 10:00 - 17:30\nÚt-Čt 8:30 - 17:30\nPá 8:30 - 17:30\nSo-Ne zavřeno',
}

export function BranchSettingsClient({ initial }: Props) {
  const [form, setForm] = useState<BranchSettingsData>({ ...DEFAULTS, ...initial })
  const [saved, setSaved] = useState<BranchSettingsData>({ ...DEFAULTS, ...initial })
  const [saving, setSaving] = useState(false)
  const [globalError, setGlobalError] = useState('')

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved)

  const set = useCallback(<K extends keyof BranchSettingsData>(key: K, value: BranchSettingsData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setGlobalError('')
  }, [])

  async function handleSave() {
    setSaving(true)
    setGlobalError('')
    try {
      await updateBranchSettings(form)
      setSaved({ ...form })
      toast.success('Uloženo.')
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Neznámá chyba.')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setForm({ ...saved })
    setGlobalError('')
  }

  return (
    <div className="flex flex-col">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <span className="text-sm text-stone-500">
          {isDirty ? (
            <span className="font-medium text-amber-600">Neuložené změny</span>
          ) : (
            'Nastavení provozovny'
          )}
        </span>
        <div className="flex gap-2">
          {isDirty && (
            <button
              onClick={handleDiscard}
              className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
            >
              Zahodit
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
          >
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>

      {globalError && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {globalError}
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-6">
        {/* Identifikace */}
        <div className="space-y-4">
          <SectionTitle>Identifikace</SectionTitle>
          <Field label="Název provozovny" required>
            <input
              className={inputCls()}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Branické lahůdkářství"
            />
          </Field>
        </div>

        {/* Adresa */}
        <div className="space-y-4">
          <SectionTitle>Adresa</SectionTitle>
          <Field label="Ulice a číslo" required>
            <input
              className={inputCls()}
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
              placeholder="Branická 75"
            />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="PSČ" required>
              <input
                className={inputCls()}
                value={form.zip}
                onChange={(e) => set('zip', e.target.value)}
                placeholder="14000"
                maxLength={6}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Město" required>
                <input
                  className={inputCls()}
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Praha"
                />
              </Field>
            </div>
          </div>
          <Field label="Země">
            <input
              className={inputCls()}
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
            />
          </Field>
        </div>

        {/* Kontakt */}
        <div className="space-y-4">
          <SectionTitle>Kontakt</SectionTitle>
          <Field label="E-mail">
            <input
              type="email"
              className={inputCls()}
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value || null)}
              placeholder="info@lahudkybranik.cz"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefon 1">
              <input
                type="tel"
                className={inputCls()}
                value={form.phone1 ?? ''}
                onChange={(e) => set('phone1', e.target.value || null)}
                placeholder="731 862 387"
              />
            </Field>
            <Field label="Telefon 2">
              <input
                type="tel"
                className={inputCls()}
                value={form.phone2 ?? ''}
                onChange={(e) => set('phone2', e.target.value || null)}
                placeholder="775 182 396"
              />
            </Field>
          </div>
        </div>

        {/* Provoz */}
        <div className="space-y-4">
          <SectionTitle>Provoz</SectionTitle>
          <Field label="Zodpovědný vedoucí">
            <input
              className={inputCls()}
              value={form.managerName ?? ''}
              onChange={(e) => set('managerName', e.target.value || null)}
              placeholder="Lubomír Markes"
            />
          </Field>
          <Field label="Otevírací doba">
            <textarea
              rows={6}
              className={inputCls() + ' resize-y font-mono'}
              value={form.openingHours ?? ''}
              onChange={(e) => set('openingHours', e.target.value || null)}
              placeholder={'Po 10:00 - 17:30\nÚt-Čt 8:30 - 17:30\nPá 8:30 - 17:30\nSo-Ne zavřeno'}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}
