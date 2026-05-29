'use client'

import { useState, useTransition } from 'react'
import { createInvoiceFromOrder } from '@/app/admin/faktury/actions'
import { formatCZK } from '@/lib/pricing'
import type { SerializedItem } from './OrderDetailClient'

interface Props {
  orderId: string
  orderNumber: string
  items: SerializedItem[]
  paymentMethodName: string
  isBusinessOrder: boolean
  proposedInvoiceNumber: string
  defaultDueDays: number
  onClose: () => void
  onCreated: (invoiceId: string) => void
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const UNIT_LABELS: Record<string, string> = {
  KS: 'ks', KG: 'kg', G_100: '100 g', L: 'l', ML_100: '100 ml',
}

export function CreateInvoiceModal({
  orderId,
  orderNumber,
  items,
  paymentMethodName,
  isBusinessOrder,
  proposedInvoiceNumber,
  defaultDueDays,
  onClose,
  onCreated,
}: Props) {
  const today = todayIso()
  const [invoiceNumber, setInvoiceNumber] = useState(proposedInvoiceNumber)
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(addDays(today, defaultDueDays))
  const [taxDate, setTaxDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState(paymentMethodName)
  const [variableSymbol, setVariableSymbol] = useState(orderNumber)
  const [pricesIncludeVat, setPricesIncludeVat] = useState(!isBusinessOrder)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError('')
    startTransition(async () => {
      try {
        const result = await createInvoiceFromOrder(orderId, {
          invoiceNumber,
          issueDate,
          dueDate,
          taxDate,
          paymentMethod,
          variableSymbol,
          pricesIncludeVat,
        })
        onCreated(result.documentId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nepodařilo se vystavit fakturu.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="font-semibold text-stone-900">Vystavit fakturu</h2>
            <p className="text-sm text-stone-500">k objednávce {orderNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Cenový režim */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Cenový režim
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="priceMode"
                  checked={pricesIncludeVat}
                  onChange={() => setPricesIncludeVat(true)}
                  className="accent-amber-500"
                />
                Ceny s DPH (B2C)
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="priceMode"
                  checked={!pricesIncludeVat}
                  onChange={() => setPricesIncludeVat(false)}
                  className="accent-amber-500"
                />
                Ceny bez DPH (B2B)
              </label>
            </div>
          </div>

          {/* Základní pole */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-stone-500">
                Číslo faktury <span className="text-red-500">*</span>
              </label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-mono focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Variabilní symbol</label>
              <input
                value={variableSymbol}
                onChange={(e) => setVariableSymbol(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Datum vystavení</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Datum splatnosti</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">DUZP</label>
              <input
                type="date"
                value={taxDate}
                onChange={(e) => setTaxDate(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Forma úhrady</label>
              <input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Items preview */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Položky ({items.length})
            </p>
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-xs">
                <thead className="bg-stone-50 text-stone-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Název</th>
                    <th className="px-3 py-2 text-center font-medium">Množ.</th>
                    <th className="px-3 py-2 text-right font-medium">Cena s DPH</th>
                    <th className="px-3 py-2 text-right font-medium">Celkem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-stone-700">
                        {item.productName}
                        {item.variantName && (
                          <span className="ml-1 text-stone-400">– {item.variantName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-stone-600">
                        {item.actualWeightKg != null
                          ? `${item.actualWeightKg} kg`
                          : `${item.quantity} ${UNIT_LABELS[item.unit] ?? item.unit}`}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-700">
                        {formatCZK(item.unitPriceWithVat)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-stone-900">
                        {formatCZK(item.lineTotalWithVat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !invoiceNumber.trim()}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            {isPending ? 'Vystavuji…' : 'Vystavit fakturu'}
          </button>
        </div>
      </div>
    </div>
  )
}
