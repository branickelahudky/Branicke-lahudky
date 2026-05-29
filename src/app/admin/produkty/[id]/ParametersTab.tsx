'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateProductParameters } from './actions'
import { ALLERGENS, COUNTRIES } from '@/lib/product-constants'
import type { SerializedProductDetail } from './ProductDetailClient'

interface Props {
  product: SerializedProductDetail
}

type NutritionState = {
  energyKj: string
  energyKcal: string
  fat: string
  saturatedFat: string
  carbohydrates: string
  sugars: string
  protein: string
  salt: string
  fiber: string
}

function parseNutrition(raw: unknown): NutritionState {
  const empty: NutritionState = {
    energyKj: '', energyKcal: '', fat: '', saturatedFat: '',
    carbohydrates: '', sugars: '', protein: '', salt: '', fiber: '',
  }
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    energyKj: r.energyKj != null ? String(r.energyKj) : '',
    energyKcal: r.energyKcal != null ? String(r.energyKcal) : '',
    fat: r.fat != null ? String(r.fat) : '',
    saturatedFat: r.saturatedFat != null ? String(r.saturatedFat) : '',
    carbohydrates: r.carbohydrates != null ? String(r.carbohydrates) : '',
    sugars: r.sugars != null ? String(r.sugars) : '',
    protein: r.protein != null ? String(r.protein) : '',
    salt: r.salt != null ? String(r.salt) : '',
    fiber: r.fiber != null ? String(r.fiber) : '',
  }
}

function nutritionToData(n: NutritionState): NutritionState | null {
  const vals = Object.values(n).filter(Boolean)
  if (vals.length === 0) return null
  return n
}

function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-stone-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
      >
        <span>{title}</span>
        <span className="text-stone-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-stone-100 px-4 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'
const textareaCls = `${inputCls} resize-y`

export function ParametersTab({ product }: Props) {
  const [isPending, startTransition] = useTransition()

  // Složení a původ
  const [ingredients, setIngredients] = useState(product.ingredients ?? '')
  const [countryOfOrigin, setCountryOfOrigin] = useState(product.countryOfOrigin ?? '')
  const [producerName, setProducerName] = useState(product.producerName ?? '')
  const [producerAddress, setProducerAddress] = useState(product.producerAddress ?? '')

  // Alergeny
  const [allergenCodes, setAllergenCodes] = useState<Set<string>>(
    () => new Set(Array.isArray(product.allergenCodes) ? (product.allergenCodes as string[]) : [])
  )
  const [allergenInfo, setAllergenInfo] = useState(product.allergenInfo ?? '')

  // Výživa
  const [nutrition, setNutrition] = useState<NutritionState>(() =>
    parseNutrition(product.nutritionPer100g)
  )

  // Spotřeba
  const [useByInstructions, setUseByInstructions] = useState(product.useByInstructions ?? '')
  const [storageInstructions, setStorageInstructions] = useState(product.storageInstructions ?? '')

  function toggleAllergen(code: string) {
    setAllergenCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function setNutritionField(field: keyof NutritionState, value: string) {
    setNutrition((prev) => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateProductParameters(product.id, {
          nutritionPer100g: nutritionToData(nutrition),
          allergenCodes: Array.from(allergenCodes),
          allergenInfo: allergenInfo || null,
          ingredients: ingredients || null,
          countryOfOrigin: countryOfOrigin || null,
          producerName: producerName || null,
          producerAddress: producerAddress || null,
          useByInstructions: useByInstructions || null,
          storageInstructions: storageInstructions || null,
        })
        toast.success('Parametry uloženy')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* 1. Složení a původ */}
      <Accordion title="Složení a původ" defaultOpen>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Složení</label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              rows={4}
              placeholder="Voda, sůl, koření…"
              className={textareaCls}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Země původu</label>
              <select
                value={countryOfOrigin}
                onChange={(e) => setCountryOfOrigin(e.target.value)}
                className={inputCls}
              >
                <option value="">— Neuvedeno —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Výrobce / Dodavatel</label>
              <input
                type="text"
                value={producerName}
                onChange={(e) => setProducerName(e.target.value)}
                placeholder="např. Masna Praha s.r.o."
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Adresa výrobce</label>
            <textarea
              value={producerAddress}
              onChange={(e) => setProducerAddress(e.target.value)}
              rows={2}
              placeholder="Ulice 1, 150 00 Praha"
              className={textareaCls}
            />
          </div>
        </div>
      </Accordion>

      {/* 2. Alergeny */}
      <Accordion title="Alergeny (EU 1169/2011)">
        <div className="space-y-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2.5">
            <p className="text-xs text-amber-800">
              Označení alergenů je ze zákona povinné pro většinu potravin (EU nařízení 1169/2011).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALLERGENS.map((a) => (
              <label key={a.code} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={allergenCodes.has(a.code)}
                  onChange={() => toggleAllergen(a.code)}
                  className="mt-0.5 rounded"
                />
                <span className="text-sm text-stone-700">
                  <span className="font-medium">{a.code}. {a.name}</span>
                  {a.detail && <span className="text-stone-400"> ({a.detail})</span>}
                </span>
              </label>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Doplňující informace o alergenech</label>
            <textarea
              value={allergenInfo}
              onChange={(e) => setAllergenInfo(e.target.value)}
              rows={2}
              placeholder="Může obsahovat stopy ořechů a sezamu"
              className={textareaCls}
            />
          </div>
        </div>
      </Accordion>

      {/* 3. Výživové hodnoty */}
      <Accordion title="Výživové hodnoty (na 100 g)">
        <div className="space-y-3">
          <p className="text-xs text-stone-400">Hodnoty na 100 g výrobku — povinné pro většinu balených potravin</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ['energyKj', 'Energie (kJ)'],
                ['energyKcal', 'Energie (kcal)'],
                ['fat', 'Tuky (g)'],
                ['saturatedFat', 'Z toho nasycené (g)'],
                ['carbohydrates', 'Sacharidy (g)'],
                ['sugars', 'Z toho cukry (g)'],
                ['protein', 'Bílkoviny (g)'],
                ['salt', 'Sůl (g)'],
                ['fiber', 'Vláknina (g)'],
              ] as [keyof NutritionState, string][]
            ).map(([field, label]) => (
              <div key={field}>
                <label className="mb-1 block text-xs font-medium text-stone-600">{label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={nutrition[field]}
                  onChange={(e) => setNutritionField(field, e.target.value)}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>
      </Accordion>

      {/* 4. Spotřeba a skladování */}
      <Accordion title="Spotřeba a skladování (pro zákazníka)">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Po otevření spotřebovat do…</label>
            <textarea
              value={useByInstructions}
              onChange={(e) => setUseByInstructions(e.target.value)}
              rows={2}
              placeholder="např. 5 dní v chladničce"
              className={textareaCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Skladovací pokyny</label>
            <textarea
              value={storageInstructions}
              onChange={(e) => setStorageInstructions(e.target.value)}
              rows={2}
              placeholder="např. Skladujte v suchu při teplotě 15-25 °C"
              className={textareaCls}
            />
          </div>
        </div>
      </Accordion>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          {isPending ? 'Ukládám…' : 'Uložit parametry'}
        </button>
      </div>
    </div>
  )
}
