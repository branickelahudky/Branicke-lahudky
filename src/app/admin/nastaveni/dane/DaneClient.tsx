'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { updateTaxSettings, updateVatRate, type TaxSettingsData, type SerializedVatRate } from './actions'

interface Props {
  initialTaxSettings: TaxSettingsData
  initialVatRates: SerializedVatRate[]
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-stone-200 pb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
      {children}
    </h3>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      {children}
    </div>
  )
}

export function DaneClient({ initialTaxSettings, initialVatRates }: Props) {
  const [taxSettings, setTaxSettings] = useState<TaxSettingsData>(initialTaxSettings)
  const [savedTaxSettings, setSavedTaxSettings] = useState<TaxSettingsData>(initialTaxSettings)
  const [vatRates, setVatRates] = useState<SerializedVatRate[]>(initialVatRates)
  const [savedVatRates, setSavedVatRates] = useState<SerializedVatRate[]>(initialVatRates)
  const [saving, setSaving] = useState(false)
  const [globalError, setGlobalError] = useState('')

  const isDirty =
    JSON.stringify(taxSettings) !== JSON.stringify(savedTaxSettings) ||
    JSON.stringify(vatRates) !== JSON.stringify(savedVatRates)

  const setTax = useCallback(<K extends keyof TaxSettingsData>(key: K, value: TaxSettingsData[K]) => {
    setTaxSettings((prev) => ({ ...prev, [key]: value }))
    setGlobalError('')
  }, [])

  function setVatRateField(id: string, key: keyof SerializedVatRate, value: unknown) {
    setVatRates((prev) =>
      prev.map((r) => {
        if (key === 'isDefault' && value === true) {
          // Pouze jedna sazba může být výchozí
          return { ...r, isDefault: r.id === id }
        }
        return r.id === id ? { ...r, [key]: value } : r
      }),
    )
    setGlobalError('')
  }

  async function handleSave() {
    setSaving(true)
    setGlobalError('')
    try {
      // Uložit TaxSettings pokud se změnilo
      if (JSON.stringify(taxSettings) !== JSON.stringify(savedTaxSettings)) {
        await updateTaxSettings(taxSettings)
        setSavedTaxSettings({ ...taxSettings })
      }

      // Uložit změněné sazby
      for (const rate of vatRates) {
        const original = savedVatRates.find((r) => r.id === rate.id)
        if (
          original &&
          (original.rate !== rate.rate ||
            original.isDefault !== rate.isDefault ||
            original.isActive !== rate.isActive)
        ) {
          await updateVatRate(rate.id, {
            rate: rate.rate,
            isDefault: rate.isDefault,
            isActive: rate.isActive,
          })
        }
      }
      setSavedVatRates(vatRates.map((r) => ({ ...r })))
      toast.success('Uloženo.')
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Neznámá chyba.')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setTaxSettings({ ...savedTaxSettings })
    setVatRates(savedVatRates.map((r) => ({ ...r })))
    setGlobalError('')
  }

  const defaultRate = vatRates.find((r) => r.isDefault)

  return (
    <div className="flex flex-col">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <span className="text-sm text-stone-500">
          {isDirty ? (
            <span className="font-medium text-amber-600">Neuložené změny</span>
          ) : (
            'Nastavení daní'
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

        {/* 1. Status plátce DPH */}
        <div className="space-y-4">
          <SectionTitle>Status plátce DPH</SectionTitle>
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="radio"
                name="vatPayer"
                checked={!taxSettings.isVatPayer}
                onChange={() => setTax('isVatPayer', false)}
                className="accent-amber-500"
              />
              Nejsem plátce DPH
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-900">
              <input
                type="radio"
                name="vatPayer"
                checked={taxSettings.isVatPayer}
                onChange={() => setTax('isVatPayer', true)}
                className="accent-amber-500"
              />
              Jsem plátce DPH
            </label>
          </div>
          <p className="text-sm text-stone-500">
            Jako plátce DPH účtujete DPH na výstupu a odvádíte ji finančnímu úřadu. Můžete uplatnit odpočet DPH na vstupu.
          </p>
        </div>

        {/* 2. Sazby DPH */}
        <div className="space-y-4">
          <SectionTitle>Sazby DPH</SectionTitle>
          <InfoBox>
            <strong>České sazby DPH (od 1. 1. 2024):</strong> Pro Branické lahůdkářství jsou klíčové
            sazby <strong>12 %</strong> (potraviny — výchozí pro nové produkty) a <strong>21 %</strong> (nápoje
            v lahvi, alkohol, doprava). Sazby v ČR stanoví zákon o DPH a nemění se
            často — úpravu provádějte pouze při legislativní změně.
          </InfoBox>

          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left">Výchozí</th>
                  <th className="px-4 py-3 text-left">Název</th>
                  <th className="px-4 py-3 text-center">Sazba</th>
                  <th className="px-4 py-3 text-left">Popis</th>
                  <th className="px-4 py-3 text-center">Aktivní</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {vatRates.map((rate) => (
                  <tr key={rate.id} className={rate.isDefault ? 'bg-amber-50' : 'bg-white'}>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name="defaultRate"
                        checked={rate.isDefault}
                        onChange={() => setVatRateField(rate.id, 'isDefault', true)}
                        disabled={!rate.isActive}
                        className="accent-amber-500"
                        title={!rate.isActive ? 'Neaktivní sazba nemůže být výchozí' : 'Nastavit jako výchozí'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-800">{rate.name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={rate.rate}
                          onChange={(e) =>
                            setVatRateField(rate.id, 'rate', parseFloat(e.target.value) || 0)
                          }
                          className="w-16 rounded border border-stone-300 px-2 py-1 text-center text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                        />
                        <span className="text-stone-500">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {rate.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          const newActive = !rate.isActive
                          // Pokud deaktivujeme výchozí sazbu, odebrat výchozí
                          if (!newActive && rate.isDefault) {
                            setVatRates((prev) =>
                              prev.map((r) =>
                                r.id === rate.id
                                  ? { ...r, isActive: false, isDefault: false }
                                  : r,
                              ),
                            )
                          } else {
                            setVatRateField(rate.id, 'isActive', newActive)
                          }
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                          rate.isActive ? 'bg-green-500' : 'bg-stone-200'
                        }`}
                        role="switch"
                        aria-checked={rate.isActive}
                        title={rate.isActive ? 'Deaktivovat' : 'Aktivovat'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                            rate.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {defaultRate && (
            <p className="text-xs text-stone-400">
              Výchozí sazba pro nové produkty: <strong>{defaultRate.rate} %</strong> ({defaultRate.name})
            </p>
          )}
        </div>

        {/* 3. Zobrazení cen */}
        <div className="space-y-4">
          <SectionTitle>Zobrazení cen</SectionTitle>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-stone-700">
                Ceny v e-shopu pro koncové zákazníky (B2C):
              </p>
              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-900">
                  <input
                    type="radio"
                    name="b2cPrices"
                    checked={taxSettings.defaultPricesIncludeVat}
                    onChange={() => setTax('defaultPricesIncludeVat', true)}
                    className="accent-amber-500"
                  />
                  S DPH (česká praxe)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                  <input
                    type="radio"
                    name="b2cPrices"
                    checked={!taxSettings.defaultPricesIncludeVat}
                    onChange={() => setTax('defaultPricesIncludeVat', false)}
                    className="accent-amber-500"
                  />
                  Bez DPH
                </label>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-stone-700">
                Ceny pro firemní zákazníky (B2B):
              </p>
              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                  <input
                    type="radio"
                    name="b2bPrices"
                    checked={taxSettings.defaultB2BPricesIncludeVat}
                    onChange={() => setTax('defaultB2BPricesIncludeVat', true)}
                    className="accent-amber-500"
                  />
                  S DPH
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-900">
                  <input
                    type="radio"
                    name="b2bPrices"
                    checked={!taxSettings.defaultB2BPricesIncludeVat}
                    onChange={() => setTax('defaultB2BPricesIncludeVat', false)}
                    className="accent-amber-500"
                  />
                  Bez DPH (česká praxe)
                </label>
              </div>
            </div>
          </div>

          <p className="text-sm text-stone-500">
            Standardně se v ČR koncovým zákazníkům zobrazují ceny <strong>včetně DPH</strong>, firmám <strong>bez DPH</strong>. Změna ovlivní výchozí zobrazení v e-shopu.
          </p>
        </div>

        {/* 4. Výchozí země */}
        <div className="space-y-4">
          <SectionTitle>Výchozí země pro daňové účely</SectionTitle>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-stone-700">Země</label>
            <select
              value={taxSettings.defaultCountry}
              onChange={(e) => setTax('defaultCountry', e.target.value)}
              className="w-48 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
            >
              <option value="CZ">Česká republika</option>
            </select>
          </div>
          <p className="text-sm text-stone-500">
            E-shop zatím prodává pouze v rámci České republiky.
          </p>
        </div>

      </div>
    </div>
  )
}
