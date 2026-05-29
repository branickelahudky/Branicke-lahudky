'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { updateOrderItem, deleteOrderItem } from './actions'
import { formatCZK, roundMoney } from '@/lib/pricing'
import type { SerializedItem } from './OrderDetailClient'

const UNIT_LABELS: Record<string, string> = {
  KS: 'ks', KG: 'kg', G_100: '100 g', L: 'l', ML_100: '100 ml',
}

const WEIGHT_UNITS = ['KG', 'G_100', 'L', 'ML_100']

// Effective quantity for line total calculation
function effectiveQty(unit: string, qty: number, weightKg: number | null): number {
  if (weightKg !== null && weightKg > 0 && WEIGHT_UNITS.includes(unit)) {
    if (unit === 'KG' || unit === 'L') return weightKg
    if (unit === 'G_100' || unit === 'ML_100') return weightKg * 10
  }
  return qty
}

interface Props {
  item: SerializedItem
  onClose: () => void
  onSaved: () => void
}

export function EditItemModal({ item, onClose, onSaved }: Props) {
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [weightKg, setWeightKg] = useState(
    item.actualWeightKg != null ? String(item.actualWeightKg) : '',
  )
  const [unitPrice, setUnitPrice] = useState(String(item.unitPriceWithVat))
  const [vatRate, setVatRate] = useState(String(item.vatRate))
  const [discount, setDiscount] = useState(String(item.discount))
  const [itemNote, setItemNote] = useState(item.itemNote ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const isWeightUnit = WEIGHT_UNITS.includes(item.unit)

  // Escape closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Live preview ──────────────────────────────────────────────

  const qtyNum = Math.max(0, parseFloat(quantity) || 0)
  const weightNum = weightKg !== '' ? parseFloat(weightKg) : null
  const priceNum = parseFloat(unitPrice) || 0
  const vatNum = parseFloat(vatRate) || 0
  const discountNum = Math.min(100, Math.max(0, parseFloat(discount) || 0))

  const effQty = effectiveQty(item.unit, qtyNum, isWeightUnit ? weightNum : null)
  const grossWithVat = roundMoney(priceNum * effQty)
  const lineTotalWithVat = roundMoney(grossWithVat * (1 - discountNum / 100))
  const lineTotalWithoutVat =
    vatNum > 0
      ? roundMoney(lineTotalWithVat / (1 + vatNum / 100))
      : lineTotalWithVat
  const lineVatAmount = roundMoney(lineTotalWithVat - lineTotalWithoutVat)

  // ── Validation ────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!quantity || parseFloat(quantity) <= 0) e.quantity = 'Kladné číslo.'
    if (!unitPrice || parseFloat(unitPrice) < 0) e.unitPrice = 'Platná cena.'
    const d = parseFloat(discount)
    if (isNaN(d) || d < 0 || d > 100) e.discount = '0–100 %.'
    if (isWeightUnit && weightKg !== '' && parseFloat(weightKg) <= 0)
      e.weightKg = 'Kladné číslo.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Handlers ──────────────────────────────────────────────────

  function handleSave() {
    if (!validate()) return
    startTransition(async () => {
      try {
        await updateOrderItem(item.id, {
          quantity: parseFloat(quantity),
          actualWeightKg:
            isWeightUnit && weightKg !== '' ? parseFloat(weightKg) : null,
          unitPriceWithVat: parseFloat(unitPrice),
          vatRate: parseFloat(vatRate),
          discount: parseFloat(discount) || 0,
          itemNote: itemNote || null,
        })
        toast.success('Položka uložena')
        onSaved()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání.')
      }
    })
  }

  function handleDelete() {
    if (!window.confirm(`Odebrat položku „${item.productName}" z objednávky?`)) return
    startTransition(async () => {
      try {
        await deleteOrderItem(item.id)
        toast.success('Položka odstraněna')
        onSaved()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při mazání.')
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="font-semibold text-stone-900">Upravit položku objednávky</h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        {/* Body: 2/3 form + 1/3 preview */}
        <div className="grid grid-cols-3 divide-x divide-stone-100">

          {/* Form */}
          <div className="col-span-2 space-y-4 p-6">

            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-stone-400">Kód produktu</p>
                <div className="rounded bg-stone-50 px-3 py-1.5 font-mono text-sm text-stone-600">
                  {item.productSku}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-stone-400">Druh</p>
                <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  Produkt
                </span>
              </div>
              <div className="col-span-2">
                <p className="mb-1 text-xs text-stone-400">Název</p>
                <div className="rounded bg-stone-50 px-3 py-1.5 text-sm text-stone-700">
                  {item.productName}
                  {item.variantName && (
                    <span className="ml-2 text-stone-400">· {item.variantName}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3">

              {/* Quantity */}
              <div>
                <label className="mb-1 block text-xs text-stone-500">
                  Množství{' '}
                  <span className="text-stone-400">({UNIT_LABELS[item.unit] ?? item.unit})</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step={isWeightUnit ? '0.001' : '1'}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full rounded border px-3 py-1.5 text-sm ${
                    errors.quantity ? 'border-red-400' : 'border-stone-300'
                  }`}
                />
                {errors.quantity && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.quantity}</p>
                )}
              </div>

              {/* Actual weight */}
              <div>
                <label className="mb-1 block text-xs text-stone-500">Skutečná váha (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  disabled={!isWeightUnit}
                  placeholder={isWeightUnit ? 'např. 0.247' : 'Pouze pro váhové produkty'}
                  className={`w-full rounded border px-3 py-1.5 text-sm ${
                    !isWeightUnit
                      ? 'cursor-not-allowed bg-stone-50 text-stone-400'
                      : errors.weightKg
                        ? 'border-red-400'
                        : 'border-stone-300'
                  }`}
                />
                {isWeightUnit && (
                  <p className="mt-0.5 text-xs text-stone-400">
                    Cena se přepočítá podle skutečné váhy
                  </p>
                )}
                {errors.weightKg && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.weightKg}</p>
                )}
              </div>

              {/* Unit price */}
              <div>
                <label className="mb-1 block text-xs text-stone-500">
                  Jedn. cena vč. DPH (Kč)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className={`w-full rounded border px-3 py-1.5 text-sm ${
                    errors.unitPrice ? 'border-red-400' : 'border-stone-300'
                  }`}
                />
                {errors.unitPrice && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.unitPrice}</p>
                )}
              </div>

              {/* VAT rate */}
              <div>
                <label className="mb-1 block text-xs text-stone-500">Sazba DPH</label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                >
                  <option value="12">12 % (potraviny)</option>
                  <option value="21">21 % (standard)</option>
                  <option value="0">0 % (osvobozeno)</option>
                </select>
              </div>

              {/* Discount */}
              <div>
                <label className="mb-1 block text-xs text-stone-500">Sleva (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={`w-full rounded border px-3 py-1.5 text-sm ${
                    errors.discount ? 'border-red-400' : 'border-stone-300'
                  }`}
                />
                {errors.discount && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.discount}</p>
                )}
              </div>
            </div>

            {/* Item note */}
            <div>
              <label className="mb-1 block text-xs text-stone-500">Poznámka k položce</label>
              <textarea
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                rows={2}
                placeholder="Interní poznámka k položce…"
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Přepočet
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Bez DPH</span>
                <span className="font-medium">{formatCZK(lineTotalWithoutVat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">DPH ({vatRate} %)</span>
                <span>{formatCZK(lineVatAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2">
                <span className="text-stone-700">S DPH</span>
                <span className="font-semibold text-stone-900">
                  {formatCZK(lineTotalWithVat)}
                </span>
              </div>
              {discountNum > 0 && (
                <div className="mt-2 space-y-1 rounded bg-green-50 p-2 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>Před slevou</span>
                    <span>{formatCZK(grossWithVat)}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Sleva ({discountNum} %)</span>
                    <span>−{formatCZK(roundMoney(grossWithVat - lineTotalWithVat))}</span>
                  </div>
                </div>
              )}
            </div>

            {isWeightUnit && (
              <div className="mt-6 rounded bg-blue-50 p-3 text-xs text-blue-700">
                {weightNum !== null && weightNum > 0 ? (
                  <p>
                    Naváženo:{' '}
                    <span className="font-semibold">
                      {weightNum.toFixed(3)} kg
                    </span>
                    {item.unit === 'G_100' &&
                      ` (= ${Math.round(weightNum * 1000)} g)`}
                  </p>
                ) : (
                  <p>Zadejte skutečnou váhu pro přepočet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Smazat položku
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              Zavřít
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              {isPending ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
