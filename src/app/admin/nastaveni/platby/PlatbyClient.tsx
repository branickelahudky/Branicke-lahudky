'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatCZK } from '@/lib/pricing'
import {
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
  type PaymentMethodData,
} from './actions'

export type SerializedPaymentMethod = {
  id: string
  name: string
  description: string | null
  feeWithVat: number
  vatRate: number
  type: string | null
  sortOrder: number
  isActive: boolean
  orderCount: number
}

// ─── Modal (module level) ─────────────────────────────────────────

const EMPTY: PaymentMethodData = {
  name: '',
  description: null,
  feeWithVat: 0,
  vatRate: 21,
  type: 'transfer',
  sortOrder: 0,
  isActive: true,
}

const TYPE_LABELS: Record<string, string> = {
  card: 'Platební karta',
  transfer: 'Bankovní převod',
  cash: 'Hotovost',
  cod: 'Dobírka',
}

function inp(cls?: string) {
  return `w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none ${cls ?? ''}`
}

function PaymentModal({
  initial,
  onClose,
  onSave,
  title,
}: {
  initial: PaymentMethodData
  title: string
  onClose: () => void
  onSave: (data: PaymentMethodData) => void
}) {
  const [form, setForm] = useState<PaymentMethodData>(initial)
  function set<K extends keyof PaymentMethodData>(k: K, v: PaymentMethodData[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-4 p-6">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-stone-500">Název *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inp()} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-stone-500">Popis</label>
            <textarea rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value || null)} className={inp('resize-none')} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Typ platby</label>
            <select value={form.type ?? ''} onChange={(e) => set('type', e.target.value || null)} className={inp()}>
              <option value="">– neurčeno –</option>
              <option value="transfer">Bankovní převod</option>
              <option value="card">Platební karta</option>
              <option value="cash">Hotovost</option>
              <option value="cod">Dobírka</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Poplatek s DPH (Kč)</label>
            <input type="number" min={0} step={0.01} value={form.feeWithVat} onChange={(e) => set('feeWithVat', parseFloat(e.target.value) || 0)} className={inp()} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Pořadí</label>
            <input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', parseInt(e.target.value) || 0)} className={inp()} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-4 accent-amber-500" />
              Aktivní
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50">Zrušit</button>
          <button onClick={() => onSave(form)} className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600">Uložit</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────

interface Props {
  methods: SerializedPaymentMethod[]
}

export function PlatbyClient({ methods }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; item: SerializedPaymentMethod } | null>(null)

  function refresh() { router.refresh() }

  function handleSave(data: PaymentMethodData) {
    startTransition(async () => {
      try {
        if (modal?.mode === 'edit') {
          await updatePaymentMethod(modal.item.id, data)
          toast.success('Způsob platby upraven.')
        } else {
          await createPaymentMethod(data)
          toast.success('Způsob platby přidán.')
        }
        setModal(null)
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba.')
      }
    })
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      try {
        await togglePaymentMethod(id, !current)
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba.')
      }
    })
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Smazat způsob platby „${name}"?`)) return
    startTransition(async () => {
      try {
        await deletePaymentMethod(id)
        toast.success('Smazáno.')
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba.')
      }
    })
  }

  const sorted = [...methods].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-800">Způsoby platby</h2>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
        >
          + Přidat
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">Žádné způsoby platby.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Název</th>
                <th className="px-4 py-2.5 text-left font-medium">Popis</th>
                <th className="px-4 py-2.5 text-center font-medium">Typ</th>
                <th className="px-4 py-2.5 text-right font-medium">Poplatek</th>
                <th className="px-4 py-2.5 text-center font-medium">Aktivní</th>
                <th className="px-4 py-2.5 text-center font-medium">Řadí</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sorted.map((m) => (
                <tr key={m.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">{m.name}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{m.description ?? '–'}</td>
                  <td className="px-4 py-3 text-center">
                    {m.type ? (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                        {TYPE_LABELS[m.type] ?? m.type}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-300">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-stone-800">
                    {m.feeWithVat === 0 ? (
                      <span className="text-green-600">Zdarma</span>
                    ) : (
                      formatCZK(m.feeWithVat)
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(m.id, m.isActive)}
                      disabled={isPending}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${m.isActive ? 'bg-green-500' : 'bg-stone-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${m.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-stone-400">{m.sortOrder}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setModal({ mode: 'edit', item: m })}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Upravit
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.name)}
                        disabled={m.orderCount > 0}
                        title={m.orderCount > 0 ? `Použito v ${m.orderCount} objednávkách` : undefined}
                        className="text-xs text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Smazat
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PaymentModal
          title={modal.mode === 'add' ? 'Nový způsob platby' : 'Upravit způsob platby'}
          initial={
            modal.mode === 'edit'
              ? {
                  name: modal.item.name,
                  description: modal.item.description,
                  feeWithVat: modal.item.feeWithVat,
                  vatRate: modal.item.vatRate,
                  type: modal.item.type,
                  sortOrder: modal.item.sortOrder,
                  isActive: modal.item.isActive,
                }
              : { ...EMPTY, sortOrder: methods.length + 1 }
          }
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
