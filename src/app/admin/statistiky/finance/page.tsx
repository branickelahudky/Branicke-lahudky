import Link from 'next/link'
import { getFinanceStats } from '@/lib/stats/finance'
import { formatCZK } from '@/lib/pricing'
import { CashFlowChart } from '../_components/FinanceChart'

const MONTH_NAMES = ['', 'Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short' }).format(d)
}

export default async function StatistikyFinancePage() {
  const stats = await getFinanceStats()
  const paidPct = stats.totalInvoiced > 0 ? Math.round((stats.totalPaid / stats.totalInvoiced) * 100) : 0

  const vatTotals = stats.vatByMonth.reduce(
    (acc, m) => ({
      base12: acc.base12 + m.base12,
      vat12: acc.vat12 + m.vat12,
      base21: acc.base21 + m.base21,
      vat21: acc.vat21 + m.vat21,
      totalVat: acc.totalVat + m.totalVat,
    }),
    { base12: 0, vat12: 0, base21: 0, vat21: 0, totalVat: 0 }
  )

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-700">Finance</h2>
          <a
            href="/api/statistiky/finance/export"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            Stáhnout DPH CSV
          </a>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">

        {/* 3 velké metriky */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Vyfakturováno {stats.year}</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{formatCZK(stats.totalInvoiced)}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Z toho zaplaceno</p>
            <p className="mt-2 text-3xl font-bold text-green-700">{formatCZK(stats.totalPaid)}</p>
            <p className="mt-1 text-xs text-stone-400">{paidPct} % z vyfakturovaného</p>
          </div>
          <div className={`rounded-xl border p-5 shadow-sm ${stats.totalOverdue > 0 ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${stats.totalOverdue > 0 ? 'text-red-700' : 'text-stone-500'}`}>Po splatnosti</p>
            <p className={`mt-2 text-3xl font-bold ${stats.totalOverdue > 0 ? 'text-red-800' : 'text-stone-900'}`}>{formatCZK(stats.totalOverdue)}</p>
            {stats.unpaidInvoices.length > 0 && (
              <p className="mt-1 text-xs text-red-600">{stats.unpaidInvoices.length} faktur čeká na platbu</p>
            )}
          </div>
        </div>

        {/* Cash flow graf */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-stone-700">Cash flow po měsících — {stats.year}</h3>
          <CashFlowChart data={stats.byMonth} />
        </div>

        {/* DPH přehled */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">DPH přehled — {stats.year}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Měsíc</th>
                  <th className="px-4 py-2.5 text-right">Základ 12 %</th>
                  <th className="px-4 py-2.5 text-right">DPH 12 %</th>
                  <th className="px-4 py-2.5 text-right">Základ 21 %</th>
                  <th className="px-4 py-2.5 text-right">DPH 21 %</th>
                  <th className="px-4 py-2.5 text-right">Celkem DPH</th>
                </tr>
              </thead>
              <tbody>
                {stats.vatByMonth.map((m) => (
                  <tr key={m.month} className="border-t border-stone-100">
                    <td className="px-4 py-2.5 text-stone-700">{MONTH_NAMES[m.month]}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{formatCZK(m.base12)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{formatCZK(m.vat12)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{formatCZK(m.base21)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{formatCZK(m.vat21)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-stone-900">{formatCZK(m.totalVat)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50">
                  <td className="px-4 py-2.5 font-semibold text-stone-700">Součet</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-stone-900">{formatCZK(vatTotals.base12)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-stone-900">{formatCZK(vatTotals.vat12)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-stone-900">{formatCZK(vatTotals.base21)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-stone-900">{formatCZK(vatTotals.vat21)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-stone-900">{formatCZK(vatTotals.totalVat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Nezaplacené faktury */}
        {stats.unpaidInvoices.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-white shadow-sm">
            <div className="border-b border-red-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-red-700">Faktury po splatnosti ({stats.unpaidInvoices.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Číslo</th>
                    <th className="px-4 py-2.5 text-left">Zákazník</th>
                    <th className="px-4 py-2.5 text-right">Částka</th>
                    <th className="px-4 py-2.5 text-right">Splatnost</th>
                    <th className="px-4 py-2.5 text-right">Dní po</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.unpaidInvoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-red-100 hover:bg-red-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/faktury/${inv.id}`} className="font-mono text-blue-600 hover:underline">{inv.number}</Link>
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-2.5 text-stone-700">{inv.customerName}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-stone-900">{formatCZK(inv.totalWithVat)}</td>
                      <td className="px-4 py-2.5 text-right text-stone-500">{fmtDate(inv.dueDate)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-red-600">{inv.daysOverdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stats.totalInvoiced === 0 && (
          <p className="text-center text-sm text-stone-400 py-4">
            Zatím žádné faktury. Statistiky se naplní s rostoucím provozem.
          </p>
        )}

      </div>
    </div>
  )
}
