'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DocumentStatus } from '@prisma/client'
import { formatCZK } from '@/lib/pricing'
import { toast } from 'sonner'

export type SerializedInvoice = {
  id: string
  number: string
  status: DocumentStatus
  customerName: string
  issueDate: string
  dueDate: string
  totalWithVat: number
  paymentMethod: string
  orderId: string | null
  orderPaymentStatus: string | null
}

interface Props {
  invoices: SerializedInvoice[]
  total: number
  totalPages: number
  currentPage: number
  currentSearch: string
  currentStatus: string
  dateFrom: string
  dateTo: string
}

const STATUS_TABS = [
  { value: '', label: 'Všechny' },
  { value: 'VALID', label: 'Platné' },
  { value: 'CANCELLED', label: 'Zrušené' },
]

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Nezaplaceno',
  PENDING: 'Čeká',
  PAID: 'Zaplaceno',
  PARTIALLY_REFUNDED: 'Čás. vráceno',
  REFUNDED: 'Vráceno',
  FAILED: 'Selhalo',
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short' }).format(new Date(iso))
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  return status === 'VALID' ? (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      Platný
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
      Zrušený
    </span>
  )
}

export function FakturyClient({
  invoices,
  total,
  totalPages,
  currentPage,
  currentSearch,
  currentStatus,
  dateFrom,
  dateTo,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch)
  const [from, setFrom] = useState(dateFrom)
  const [to, setTo] = useState(dateTo)

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams()
    const s = overrides.hledat ?? search
    const st = overrides.status ?? currentStatus
    const f = overrides.od ?? from
    const t = overrides.do ?? to
    const p = overrides.strana ?? '1'
    if (s) params.set('hledat', s)
    if (st) params.set('status', st)
    if (f) params.set('od', f)
    if (t) params.set('do', t)
    if (p !== '1') params.set('strana', p)
    const qs = params.toString()
    return `/admin/faktury${qs ? `?${qs}` : ''}`
  }

  function applySearch() {
    router.push(buildUrl({ strana: '1' }))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') applySearch()
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Sticky bar */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status tabs */}
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={buildUrl({ status: tab.value, strana: '1' })}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  currentStatus === tab.value
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => toast.info('Vyber objednávku v sekci Objednávky a klikni „Vystavit fakturu".')}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Vystavit fakturu
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-stone-100 bg-stone-50 px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs text-stone-500">Hledat (číslo, zákazník)</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="2026-01 nebo Novák…"
              className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Datum od</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Datum do</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <button
            onClick={applySearch}
            className="rounded-lg bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            Filtrovat
          </button>
          {(currentSearch || currentStatus || dateFrom || dateTo) && (
            <Link href="/admin/faktury" className="text-sm text-stone-500 hover:underline">
              Zrušit filtr
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto px-6 py-4">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-stone-400">
            <p className="text-lg font-medium">Žádné faktury</p>
            <p className="text-sm">
              {currentSearch || currentStatus || dateFrom || dateTo
                ? 'Zkus upravit filtr.'
                : 'Faktury se vystaví z detailu objednávky.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 text-xs text-stone-500">
                <tr>
                  <th className="pb-2 text-left font-medium">Číslo</th>
                  <th className="pb-2 text-left font-medium">Odběratel</th>
                  <th className="pb-2 text-left font-medium">Vystaveno</th>
                  <th className="pb-2 text-left font-medium">Splatnost</th>
                  <th className="pb-2 text-right font-medium">Celkem</th>
                  <th className="pb-2 text-left font-medium">Stav</th>
                  <th className="pb-2 text-left font-medium">Úhrada</th>
                  <th className="pb-2 text-left font-medium">Zaplaceno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-stone-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/faktury/${inv.id}`}
                        className="font-mono font-medium text-blue-600 hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-stone-800">{inv.customerName}</td>
                    <td className="py-3 pr-4 text-stone-600">{fmtDate(inv.issueDate)}</td>
                    <td className="py-3 pr-4 text-stone-600">{fmtDate(inv.dueDate)}</td>
                    <td className="py-3 pr-4 text-right font-medium text-stone-900">
                      {formatCZK(inv.totalWithVat)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3 pr-4 text-stone-600">{inv.paymentMethod}</td>
                    <td className="py-3">
                      {inv.orderPaymentStatus ? (
                        <span
                          className={`text-xs font-medium ${
                            inv.orderPaymentStatus === 'PAID'
                              ? 'text-green-700'
                              : 'text-stone-500'
                          }`}
                        >
                          {PAYMENT_STATUS_LABEL[inv.orderPaymentStatus] ?? inv.orderPaymentStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-stone-500">
                  Celkem {total} faktur
                </span>
                <div className="flex gap-1">
                  {currentPage > 1 && (
                    <Link
                      href={buildUrl({ strana: String(currentPage - 1) })}
                      className="rounded border border-stone-300 px-3 py-1.5 text-stone-600 hover:bg-stone-50"
                    >
                      ← Předchozí
                    </Link>
                  )}
                  <span className="flex items-center px-3 text-stone-500">
                    {currentPage} / {totalPages}
                  </span>
                  {currentPage < totalPages && (
                    <Link
                      href={buildUrl({ strana: String(currentPage + 1) })}
                      className="rounded border border-stone-300 px-3 py-1.5 text-stone-600 hover:bg-stone-50"
                    >
                      Další →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
