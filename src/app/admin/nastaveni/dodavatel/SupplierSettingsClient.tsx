'use client'

import { useState, useCallback } from 'react'
import { upsertSupplierSettings, type SupplierSettingsData } from './actions'

interface Props {
  initial: SupplierSettingsData
}

// Czech IBAN calculation (mod-97 algorithm)
function czechAccountToIban(accountNumber: string): string | null {
  const match = accountNumber.replace(/\s/g, '').match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/)
  if (!match) return null
  const preNum = (match[1] ?? '').padStart(6, '0')
  const accNum = match[2].padStart(10, '0')
  const bankCode = match[3]
  const bban = bankCode + preNum + accNum
  // Check digits: move "CZ00" to end, replace letters, compute 98 - (mod 97)
  const rearranged = bban + '123500' // CZ = 12 35, 00 placeholder
  const mod = BigInt(rearranged) % 97n
  const checkDigits = String(98n - mod).padStart(2, '0')
  const raw = `CZ${checkDigits}${bban}`
  // Format with spaces every 4 chars
  return raw.replace(/(.{4})/g, '$1 ').trim()
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
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
      {hint && !error && <p className="text-xs text-stone-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
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

function inputCls(hasError?: boolean) {
  return [
    'rounded-lg border px-3 py-2 text-sm outline-none transition',
    'focus:ring-2 focus:ring-amber-400 focus:border-amber-400',
    hasError ? 'border-red-400 bg-red-50' : 'border-stone-300 bg-white',
  ].join(' ')
}

const DEFAULTS: SupplierSettingsData = {
  companyName: '',
  street: '',
  city: '',
  postalCode: '',
  country: 'Česká republika',
  companyId: '',
  vatId: '',
  isVatPayer: true,
  bankAccount: '',
  iban: '',
  legalNote: '',
  logoUrl: '',
  invoiceFooterNote: '',
  defaultDueDays: 14,
}

export function SupplierSettingsClient({ initial }: Props) {
  const [form, setForm] = useState<SupplierSettingsData>({ ...DEFAULTS, ...initial })
  const [saved, setSaved] = useState<SupplierSettingsData>({ ...DEFAULTS, ...initial })
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierSettingsData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [globalError, setGlobalError] = useState('')

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved)

  const set = useCallback(
    <K extends keyof SupplierSettingsData>(key: K, value: SupplierSettingsData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
      setSuccessMsg('')
      setGlobalError('')
    },
    [],
  )

  async function handleSave() {
    setSaving(true)
    setGlobalError('')
    setSuccessMsg('')
    try {
      await upsertSupplierSettings(form)
      setSaved({ ...form })
      setSuccessMsg('Nastavení uloženo.')
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Neznámá chyba.')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setForm({ ...saved })
    setErrors({})
    setGlobalError('')
    setSuccessMsg('')
  }

  return (
    <div className="flex flex-col">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <span className="text-sm text-stone-500">
          {isDirty ? (
            <span className="font-medium text-amber-600">Neuložené změny</span>
          ) : successMsg ? (
            <span className="font-medium text-green-600">{successMsg}</span>
          ) : (
            'Nastavení dodavatele'
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
        {/* Základní identifikace */}
        <div className="space-y-4">
          <SectionTitle>Identifikace firmy</SectionTitle>
          <Field label="Název firmy" required error={errors.companyName}>
            <input
              className={inputCls(!!errors.companyName)}
              value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)}
              placeholder="Lubomír Markes"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="IČO" required error={errors.companyId}>
              <input
                className={inputCls(!!errors.companyId)}
                value={form.companyId}
                onChange={(e) => set('companyId', e.target.value)}
                placeholder="61850519"
                maxLength={8}
              />
            </Field>
            <Field label="DIČ" error={errors.vatId}>
              <input
                className={inputCls(!!errors.vatId)}
                value={form.vatId ?? ''}
                onChange={(e) => set('vatId', e.target.value || null)}
                placeholder="CZ6506150244"
                disabled={!form.isVatPayer}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.isVatPayer}
              onChange={(e) => set('isVatPayer', e.target.checked)}
              className="size-4 rounded border-stone-300 accent-amber-500"
            />
            Plátce DPH
          </label>
        </div>

        {/* Adresa */}
        <div className="space-y-4">
          <SectionTitle>Adresa sídla</SectionTitle>
          <Field label="Ulice a číslo" required error={errors.street}>
            <input
              className={inputCls(!!errors.street)}
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
              placeholder="Braník 25"
            />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="PSČ" required error={errors.postalCode}>
              <input
                className={inputCls(!!errors.postalCode)}
                value={form.postalCode}
                onChange={(e) => set('postalCode', e.target.value)}
                placeholder="147 00"
                maxLength={6}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Město" required error={errors.city}>
                <input
                  className={inputCls(!!errors.city)}
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Praha 4"
                />
              </Field>
            </div>
          </div>
          <Field label="Země" error={errors.country}>
            <input
              className={inputCls(!!errors.country)}
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
            />
          </Field>
        </div>

        {/* Platební údaje */}
        <div className="space-y-4">
          <SectionTitle>Platební údaje</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Číslo účtu" error={errors.bankAccount}>
              <input
                className={inputCls(!!errors.bankAccount)}
                value={form.bankAccount ?? ''}
                onChange={(e) => set('bankAccount', e.target.value || null)}
                placeholder="269410328/0300"
              />
            </Field>
            <Field
              label="IBAN"
              hint="Potřebné pro QR platbu na faktuře. Formát: CZ65 0300 0000 0002 6941 0328"
              error={errors.iban}
            >
              <div className="flex gap-2">
                <input
                  className={inputCls(!!errors.iban) + ' flex-1'}
                  value={form.iban ?? ''}
                  onChange={(e) => set('iban', e.target.value || null)}
                  placeholder="CZ65 0300 0000 0026 9410 3280"
                />
                {form.bankAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      const iban = czechAccountToIban(form.bankAccount ?? '')
                      if (iban) set('iban', iban)
                    }}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 whitespace-nowrap"
                  >
                    Spočítat
                  </button>
                )}
              </div>
            </Field>
          </div>
          <Field label="Výchozí splatnost (dny)" required error={errors.defaultDueDays}>
            <input
              type="number"
              min={1}
              max={365}
              className={inputCls(!!errors.defaultDueDays)}
              value={form.defaultDueDays}
              onChange={(e) => set('defaultDueDays', parseInt(e.target.value) || 14)}
            />
          </Field>
        </div>

        {/* Texty na dokladech */}
        <div className="space-y-4">
          <SectionTitle>Texty na dokladech</SectionTitle>
          <Field label="Zápatí faktury" error={errors.invoiceFooterNote}>
            <textarea
              rows={3}
              className={inputCls(!!errors.invoiceFooterNote) + ' resize-none'}
              value={form.invoiceFooterNote ?? ''}
              onChange={(e) => set('invoiceFooterNote', e.target.value || null)}
              placeholder="Např. Děkujeme za Váš nákup."
            />
          </Field>
          <Field label="Právní poznámka" error={errors.legalNote}>
            <textarea
              rows={2}
              className={inputCls(!!errors.legalNote) + ' resize-none'}
              value={form.legalNote ?? ''}
              onChange={(e) => set('legalNote', e.target.value || null)}
              placeholder="Fyzická osoba zapsaná v živnostenském rejstříku…"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}
