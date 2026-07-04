'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateProductLogistics } from './actions'
import { STORAGE_TEMP_LABELS } from '@/lib/product-constants'
import type { SerializedProductDetail } from './ProductDetailClient'

interface Props {
  product: SerializedProductDetail
}

function parseIntOrNull(val: string): number | null {
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

export function LogisticsTab({ product }: Props) {
  const [isPending, startTransition] = useTransition()

  const [weightGrams, setWeightGrams] = useState(product.weightGrams != null ? String(product.weightGrams) : '')
  const [lengthMm, setLengthMm] = useState(product.lengthMm != null ? String(product.lengthMm) : '')
  const [widthMm, setWidthMm] = useState(product.widthMm != null ? String(product.widthMm) : '')
  const [heightMm, setHeightMm] = useState(product.heightMm != null ? String(product.heightMm) : '')
  const [storageTemp, setStorageTemp] = useState(product.storageTemp ?? 'ROOM_TEMP')
  const [shelfLifeDays, setShelfLifeDays] = useState(product.shelfLifeDays != null ? String(product.shelfLifeDays) : '')
  const [isFragile, setIsFragile] = useState(product.isFragile ?? false)

  function handleSave() {
    startTransition(async () => {
      try {
        await updateProductLogistics(product.id, {
          weightGrams: parseIntOrNull(weightGrams),
          lengthMm: parseIntOrNull(lengthMm),
          widthMm: parseIntOrNull(widthMm),
          heightMm: parseIntOrNull(heightMm),
          storageTemp,
          shelfLifeDays: parseIntOrNull(shelfLifeDays),
          isFragile,
        })
        toast.success('Logistika uložena')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  const inputCls = 'w-full rounded border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400'

  return (
    <div className="space-y-6">
      {/* Hmotnost a rozměry */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-stone-700">Hmotnost a rozměry</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Hmotnost (g)</label>
            {product.isWeightBased ? (
              <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-400">
                Neuplatní se — u váhového produktu je váha = objednané množství.
              </p>
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  placeholder="např. 250"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-stone-400">
                  Hmotnost jednoho kusu vč. obalu — pro výpočet dopravy.
                </p>
              </>
            )}
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-stone-700">Rozměry (mm)</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={lengthMm}
                  onChange={(e) => setLengthMm(e.target.value)}
                  placeholder="Délka"
                  className={inputCls}
                />
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  placeholder="Šířka"
                  className={inputCls}
                />
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={heightMm}
                  onChange={(e) => setHeightMm(e.target.value)}
                  placeholder="Výška"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-400">Pro výpočet ceny dopravy a velikosti balíku</p>
      </div>

      {/* Skladování */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-stone-700">Skladování a trvanlivost</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Skladovací teplota</label>
            <select
              value={storageTemp}
              onChange={(e) => setStorageTemp(e.target.value)}
              className={inputCls}
            >
              {Object.entries(STORAGE_TEMP_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Trvanlivost (dny)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={shelfLifeDays}
              onChange={(e) => setShelfLifeDays(e.target.value)}
              placeholder="např. 90"
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isFragile}
              onChange={(e) => setIsFragile(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-stone-700">Křehké zboží</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-stone-400">Důležité pro PPL chlazenou přepravu</p>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Ukládám…' : 'Uložit logistiku'}
      </button>
    </div>
  )
}
