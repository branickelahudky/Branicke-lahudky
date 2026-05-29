import Link from 'next/link'
import { getCustomersStats } from '@/lib/stats/customers'
import { formatCZK } from '@/lib/pricing'
import { TwoPieChart } from '../_components/OrderCharts'

export default async function StatistikyZakazniciPage() {
  const stats = await getCustomersStats()

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <h2 className="text-sm font-medium text-stone-700">Zákazníci</h2>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">

        {/* Metriky */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Noví zákazníci {stats.year}</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{stats.newCustomers}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Opakovaní {stats.year}</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{stats.returningCustomers}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Průměrná CLV</p>
            <p className="mt-2 text-2xl font-bold text-stone-900">{formatCZK(stats.avgCLV)}</p>
            <p className="mt-1 text-xs text-stone-400">Celkový obrat na zákazníka (lifetime)</p>
          </div>
        </div>

        {/* Koláčový + TOP PSČ */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-stone-700">Noví vs. opakovaní — {stats.year}</h3>
            <TwoPieChart
              a={{ label: 'Noví', value: stats.newCustomers }}
              b={{ label: 'Opakovaní', value: stats.returningCustomers }}
            />
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-stone-700">TOP 10 PSČ</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">PSČ</th>
                    <th className="px-4 py-2.5 text-left">Město</th>
                    <th className="px-4 py-2.5 text-right">Objednávek</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPSC.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400">Žádná data</td></tr>
                  )}
                  {stats.topPSC.map((r, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-4 py-2.5 font-mono text-stone-700">{r.postalCode}</td>
                      <td className="px-4 py-2.5 text-stone-600">{r.city}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-stone-900">{r.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* TOP zákazníci */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">TOP 20 zákazníků (celková útrata)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-right w-8">#</th>
                  <th className="px-4 py-2.5 text-left">Zákazník</th>
                  <th className="px-4 py-2.5 text-right">Objednávek</th>
                  <th className="px-4 py-2.5 text-right">Celkem</th>
                  <th className="px-4 py-2.5 text-right">AOV</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCustomers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">Žádná data</td></tr>
                )}
                {stats.topCustomers.map((c, i) => (
                  <tr key={c.customerId} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-2.5 text-right text-stone-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/zakaznici/${c.customerId}`} className="text-stone-700 hover:text-blue-600 hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                      <p className="text-xs text-stone-400">{c.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{c.orderCount}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-stone-900">{formatCZK(c.totalSpent)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-500">{formatCZK(c.aov)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
