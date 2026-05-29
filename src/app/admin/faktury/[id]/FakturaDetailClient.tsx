'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentStatus } from '@prisma/client'
import { toast } from 'sonner'
import { Download, Printer } from 'lucide-react'
import { formatCZK, roundMoney } from '@/lib/pricing'
import { updateInvoice, deleteInvoice, type UpdateInvoiceData } from '../actions'

// ─── Types ────────────────────────────────────────────────────────

export type SerializedDocumentItem = {
  id: string
  description: string
  quantity: number
  unit: string
  unitPriceWithoutVat: number
  unitPriceWithVat: number
  vatRate: number
  discount: number | null
  lineTotalWithoutVat: number
  lineVatAmount: number
  lineTotalWithVat: number
  sortOrder: number
}

export type VatBreakdownEntry = {
  rate: number
  base: number
  vat: number
}

export type SerializedDocument = {
  id: string
  number: string
  status: DocumentStatus
  orderId: string | null
  orderNumber: string | null
  customerId: string | null
  // Supplier
  supplierName: string
  supplierStreet: string
  supplierCity: string
  supplierPostalCode: string
  supplierCountry: string
  supplierCompanyId: string
  supplierVatId: string | null
  supplierBankAccount: string | null
  supplierLegalNote: string | null
  // Customer
  customerName: string
  customerStreet: string | null
  customerCity: string | null
  customerPostalCode: string | null
  customerCountry: string | null
  customerCompanyId: string | null
  customerVatId: string | null
  customerEmail: string | null
  customerPhone: string | null
  // Dates
  issueDate: string
  dueDate: string
  taxDate: string
  // Payment
  variableSymbol: string
  constantSymbol: string | null
  specificSymbol: string | null
  paymentMethod: string
  pricesIncludeVat: boolean
  // Totals
  subtotalWithoutVat: number
  totalVat: number
  totalWithVat: number
  vatBreakdown: VatBreakdownEntry[]
  items: SerializedDocumentItem[]
  note: string | null
  internalNote: string | null
  createdAt: string
  updatedAt: string
}

// ─── Form state ───────────────────────────────────────────────────

type EditableItem = SerializedDocumentItem & {
  // computed client-side
  lineTotalWithVat: number
  lineTotalWithoutVat: number
  lineVatAmount: number
}

type FormState = {
  number: string
  status: DocumentStatus
  issueDate: string
  dueDate: string
  taxDate: string
  variableSymbol: string
  constantSymbol: string
  specificSymbol: string
  paymentMethod: string
  note: string
  internalNote: string
  items: EditableItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────

function recalcItem(item: EditableItem): EditableItem {
  const discountFactor = item.discount ? 1 - item.discount / 100 : 1
  const lineTotalWithVat = roundMoney(item.quantity * item.unitPriceWithVat * discountFactor)
  const lineTotalWithoutVat = roundMoney(lineTotalWithVat / (1 + item.vatRate / 100))
  const lineVatAmount = roundMoney(lineTotalWithVat - lineTotalWithoutVat)
  const unitPriceWithoutVat = roundMoney(item.unitPriceWithVat / (1 + item.vatRate / 100))
  return { ...item, lineTotalWithVat, lineTotalWithoutVat, lineVatAmount, unitPriceWithoutVat }
}

function computeTotals(items: EditableItem[]) {
  const bd: Record<number, VatBreakdownEntry> = {}
  let subtotalWithoutVat = 0
  let totalVat = 0
  let totalWithVat = 0
  for (const item of items) {
    subtotalWithoutVat = roundMoney(subtotalWithoutVat + item.lineTotalWithoutVat)
    totalVat = roundMoney(totalVat + item.lineVatAmount)
    totalWithVat = roundMoney(totalWithVat + item.lineTotalWithVat)
    bd[item.vatRate] ??= { rate: item.vatRate, base: 0, vat: 0 }
    bd[item.vatRate].base = roundMoney(bd[item.vatRate].base + item.lineTotalWithoutVat)
    bd[item.vatRate].vat = roundMoney(bd[item.vatRate].vat + item.lineVatAmount)
  }
  return { subtotalWithoutVat, totalVat, totalWithVat, vatBreakdown: Object.values(bd) }
}

function isoToDateInput(iso: string) {
  return iso.slice(0, 10)
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short' }).format(new Date(iso))
}

function buildInitial(doc: SerializedDocument): FormState {
  return {
    number: doc.number,
    status: doc.status,
    issueDate: isoToDateInput(doc.issueDate),
    dueDate: isoToDateInput(doc.dueDate),
    taxDate: isoToDateInput(doc.taxDate),
    variableSymbol: doc.variableSymbol,
    constantSymbol: doc.constantSymbol ?? '',
    specificSymbol: doc.specificSymbol ?? '',
    paymentMethod: doc.paymentMethod,
    note: doc.note ?? '',
    internalNote: doc.internalNote ?? '',
    items: doc.items.map((item) => recalcItem({ ...item })),
  }
}

function inputCls(hasError?: boolean) {
  return [
    'rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400',
    hasError ? 'border-red-400' : 'border-stone-300',
  ].join(' ')
}

// ─── Module-level sub-components ─────────────────────────────────

function AddressColumn({
  title,
  lines,
}: {
  title: string
  lines: (string | null | undefined)[]
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
      <address className="not-italic text-sm leading-relaxed text-stone-700">
        {lines.filter(Boolean).map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </address>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────

interface Props {
  doc: SerializedDocument
  userRole: string
}

export function FakturaDetailClient({ doc, userRole }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => buildInitial(doc))
  const [saved, setSaved] = useState<FormState>(() => buildInitial(doc))
  const [saving, setSaving] = useState(false)
  const [numberWarning, setNumberWarning] = useState(false)

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved)
  const totals = computeTotals(form.items)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === 'number' && value !== doc.number) setNumberWarning(true)
    else if (key === 'number') setNumberWarning(false)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateItem(idx: number, patch: Partial<EditableItem>) {
    setForm((prev) => {
      const items = [...prev.items]
      items[idx] = recalcItem({ ...items[idx], ...patch })
      return { ...prev, items }
    })
  }

  function buildSaveData(): UpdateInvoiceData {
    return {
      number: form.number,
      status: form.status,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      taxDate: form.taxDate,
      variableSymbol: form.variableSymbol,
      constantSymbol: form.constantSymbol || null,
      specificSymbol: form.specificSymbol || null,
      paymentMethod: form.paymentMethod,
      note: form.note || null,
      internalNote: form.internalNote || null,
      items: form.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPriceWithVat: item.unitPriceWithVat,
        vatRate: item.vatRate,
        discount: item.discount,
      })),
    }
  }

  async function handleSave(andLeave?: boolean) {
    setSaving(true)
    try {
      await updateInvoice(doc.id, buildSaveData())
      if (andLeave) {
        router.push('/admin/faktury')
      } else {
        setSaved({ ...form })
        toast.success('Faktura uložena.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba při ukládání.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Smazat fakturu ${doc.number}?\n\nAkce je nevratná a faktura bude trvale odstraněna.`,
      )
    )
      return
    try {
      await deleteInvoice(doc.id)
      router.push('/admin/faktury')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba při mazání.')
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={!isDirty || saving}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-40"
            >
              Uložit a odejít
            </button>
            {userRole === 'OWNER' && (
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Smazat
              </button>
            )}
            <div className="mx-1 h-5 w-px bg-stone-200" />
            <a
              href={`/api/faktury/${doc.id}/pdf`}
              download
              className="flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              <Download className="h-3.5 w-3.5" />
              Stáhnout PDF
            </a>
            <button
              onClick={() => window.open(`/api/faktury/${doc.id}/pdf?inline=true`, '_blank')}
              className="flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Tisk
            </button>
            {doc.orderId && (
              <a
                href={`/admin/objednavky/${doc.orderId}`}
                className="text-sm text-blue-600 hover:underline"
              >
                ← Objednávka {doc.orderNumber}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-sm font-medium text-amber-600">Neuložené změny</span>
            )}
            <button
              onClick={() => router.push('/admin/faktury')}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
            >
              Zpět
            </button>
          </div>
        </div>
        {isDirty && <div className="mt-2 h-0.5 w-full rounded bg-amber-400" />}
      </div>

      <div className="flex-1 space-y-6 px-6 py-6">
        {numberWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Pozor: Manuální změna čísla faktury může narušit číselnou řadu.
          </div>
        )}

        {/* 3 address columns */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AddressColumn
            title="Kontakt na zákazníka"
            lines={[
              doc.customerName,
              doc.customerEmail,
              doc.customerPhone,
              doc.customerCompanyId ? `IČO: ${doc.customerCompanyId}` : null,
              doc.customerVatId ? `DIČ: ${doc.customerVatId}` : null,
            ]}
          />
          <AddressColumn
            title="Fakturační adresa"
            lines={[
              doc.customerName,
              doc.customerStreet,
              [doc.customerPostalCode, doc.customerCity].filter(Boolean).join(' ') || null,
              doc.customerCountry && doc.customerCountry !== 'Česká republika'
                ? doc.customerCountry
                : null,
            ]}
          />
          <AddressColumn
            title="Dodavatel"
            lines={[
              doc.supplierName,
              doc.supplierStreet,
              [doc.supplierPostalCode, doc.supplierCity].filter(Boolean).join(' '),
              `IČO: ${doc.supplierCompanyId}`,
              doc.supplierVatId ? `DIČ: ${doc.supplierVatId}` : null,
              doc.supplierBankAccount ? `Účet: ${doc.supplierBankAccount}` : null,
            ]}
          />
        </div>

        <p className="text-xs text-stone-400">
          Údaje zákazníka jsou snapshot v čase vystavení faktury. Faktura je daňový doklad — tyto údaje nelze měnit zpětně.
        </p>

        {/* Editable fields */}
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-stone-700">Základní údaje</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-stone-500">Číslo faktury</label>
              <input
                value={form.number}
                onChange={(e) => setField('number', e.target.value)}
                className={`w-full font-mono ${inputCls()}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Stav</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as DocumentStatus)}
                className={`w-full ${inputCls()}`}
              >
                <option value="VALID">Platný</option>
                <option value="CANCELLED">Zrušený</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Forma úhrady</label>
              <input
                value={form.paymentMethod}
                onChange={(e) => setField('paymentMethod', e.target.value)}
                className={`w-full ${inputCls()}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Datum vystavení</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setField('issueDate', e.target.value)}
                className={`w-full ${inputCls()}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Datum splatnosti</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setField('dueDate', e.target.value)}
                className={`w-full ${inputCls()}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">DUZP</label>
              <input
                type="date"
                value={form.taxDate}
                onChange={(e) => setField('taxDate', e.target.value)}
                className={`w-full ${inputCls()}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Variabilní symbol</label>
              <input
                value={form.variableSymbol}
                onChange={(e) => setField('variableSymbol', e.target.value)}
                className={`w-full ${inputCls()}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Konstantní symbol</label>
              <input
                value={form.constantSymbol}
                onChange={(e) => setField('constantSymbol', e.target.value)}
                placeholder="0308"
                className={`w-full ${inputCls()}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-stone-500">Specifický symbol</label>
              <input
                value={form.specificSymbol}
                onChange={(e) => setField('specificSymbol', e.target.value)}
                className={`w-full ${inputCls()}`}
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-lg border border-stone-200 bg-white">
          <h2 className="border-b border-stone-100 px-5 py-3 text-sm font-semibold text-stone-700">
            Položky
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Popis</th>
                  <th className="px-3 py-2.5 text-center font-medium">Jedn.</th>
                  <th className="px-3 py-2.5 text-center font-medium w-20">Množ.</th>
                  <th className="px-3 py-2.5 text-right font-medium w-28">Cena s DPH</th>
                  <th className="px-3 py-2.5 text-center font-medium w-16">DPH %</th>
                  <th className="px-3 py-2.5 text-center font-medium w-16">Sleva %</th>
                  <th className="px-3 py-2.5 text-right font-medium">Základ</th>
                  <th className="px-3 py-2.5 text-right font-medium">Celkem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {form.items.map((item, idx) => (
                  <tr key={item.id} className="group">
                    <td className="px-4 py-2.5">
                      <p className="text-stone-800">{item.description}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center text-stone-500">{item.unit}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded border border-stone-300 px-2 py-1 text-center text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPriceWithVat}
                        onChange={(e) =>
                          updateItem(idx, { unitPriceWithVat: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded border border-stone-300 px-2 py-1 text-right text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={item.vatRate}
                        onChange={(e) => updateItem(idx, { vatRate: parseInt(e.target.value) })}
                        className="w-full rounded border border-stone-300 px-1 py-1 text-sm focus:border-amber-400 focus:outline-none"
                      >
                        <option value={0}>0 %</option>
                        <option value={12}>12 %</option>
                        <option value={21}>21 %</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={item.discount ?? ''}
                        onChange={(e) =>
                          updateItem(idx, {
                            discount: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                        placeholder="0"
                        className="w-full rounded border border-stone-300 px-2 py-1 text-center text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-stone-700">
                      {formatCZK(item.lineTotalWithoutVat)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-stone-900">
                      {formatCZK(item.lineTotalWithVat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* VAT Breakdown + Totals */}
        <div className="ml-auto w-full max-w-sm space-y-2">
          {/* VAT breakdown table */}
          <div className="rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Sazba DPH</th>
                  <th className="px-4 py-2 text-right font-medium">Základ</th>
                  <th className="px-4 py-2 text-right font-medium">DPH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {totals.vatBreakdown
                  .sort((a, b) => a.rate - b.rate)
                  .map((row) => (
                    <tr key={row.rate}>
                      <td className="px-4 py-2 text-stone-600">{row.rate} %</td>
                      <td className="px-4 py-2 text-right text-stone-700">
                        {formatCZK(row.base)}
                      </td>
                      <td className="px-4 py-2 text-right text-stone-700">
                        {formatCZK(row.vat)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="rounded-lg border border-stone-200 bg-white">
            <dl className="divide-y divide-stone-100 text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-stone-500">Základ daně celkem</dt>
                <dd className="font-medium text-stone-800">
                  {formatCZK(totals.subtotalWithoutVat)}
                </dd>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-stone-500">DPH celkem</dt>
                <dd className="font-medium text-stone-800">{formatCZK(totals.totalVat)}</dd>
              </div>
              <div className="flex justify-between bg-stone-50 px-4 py-3">
                <dt className="font-semibold text-stone-900">Celkem k úhradě</dt>
                <dd className="text-lg font-bold text-stone-900">
                  {formatCZK(totals.totalWithVat)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Notes */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500">
              Poznámka na faktuře
            </label>
            <textarea
              rows={3}
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              placeholder="Viditelné pro zákazníka…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-500">
              Interní poznámka
            </label>
            <textarea
              rows={3}
              value={form.internalNote}
              onChange={(e) => setField('internalNote', e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              placeholder="Viditelné pouze pro adminy…"
            />
          </div>
        </div>

        <p className="pb-4 text-xs text-stone-400">
          Vystavena: {fmtDate(doc.createdAt)} · Upravena: {fmtDate(doc.updatedAt)}
          {doc.supplierLegalNote && ` · ${doc.supplierLegalNote}`}
        </p>
      </div>
    </div>
  )
}
