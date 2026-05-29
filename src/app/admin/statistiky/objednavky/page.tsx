import { getOrdersStats } from '@/lib/stats/orders'
import { formatCZK } from '@/lib/pricing'
import { STATUS_LABELS } from '@/lib/order-status'
import { MonthlyOrdersChart, AovTrendChart, TwoPieChart } from '../_components/OrderCharts'

export default async function StatistikyObjednavkyPage() {
  const stats = await getOrdersStats()
  const deltaCount = stats.totalLastYear > 0
    ? Math.round(((stats.totalThisYear - stats.totalLastYear) / stats.totalLastYear) * 100)
    : null
  const deltaAov = stats.aovLastYear > 0
    ? Math.round(((stats.aovThisYear - stats.aovLastYear) / stats.aovLastYear) * 100)
    : null

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <h2 className="text-sm font-medium text-stone-700">Objednávky</h2>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">

        {/* Metriky */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Objednávek {stats.year}</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{stats.totalThisYear}</p>
            {deltaCount !== null && (
              <p className={`mt-1 text-xs font-medium ${deltaCount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {deltaCount >= 0 ? '↑' : '↓'}{Math.abs(deltaCount)} % vs. {stats.year - 1}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">AOV {stats.year}</p>
            <p className="mt-2 text-2xl font-bold text-stone-900">{formatCZK(stats.aovThisYear)}</p>
            {deltaAov !== null && (
              <p className={`mt-1 text-xs font-medium ${deltaAov >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {deltaAov >= 0 ? '↑' : '↓'}{Math.abs(deltaAov)} % vs. {stats.year - 1}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">B2B {stats.year}</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{stats.b2cVsB2b.b2b}</p>
            <p className="mt-1 text-xs text-stone-400">B2C: {stats.b2cVsB2b.b2c}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Osobní odběr</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{stats.pickupVsDelivery.pickup}</p>
            <p className="mt-1 text-xs text-stone-400">Doručení: {stats.pickupVsDelivery.delivery}</p>
          </div>
        </div>

        {/* Měsíční grafy */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-stone-700">Objednávky po měsících — {stats.year}</h3>
            <MonthlyOrdersChart data={stats.byMonth} />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-stone-700">AOV trend — {stats.year}</h3>
            <AovTrendChart data={stats.byMonth} />
          </div>
        </div>

        {/* Koláčové grafy */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-stone-700">Odběr vs. doručení (celkem)</h3>
            <TwoPieChart
              a={{ label: 'Odběr', value: stats.pickupVsDelivery.pickup }}
              b={{ label: 'Doručení', value: stats.pickupVsDelivery.delivery }}
            />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-stone-700">B2C vs. B2B — {stats.year}</h3>
            <TwoPieChart
              a={{ label: 'B2C', value: stats.b2cVsB2b.b2c }}
              b={{ label: 'B2B', value: stats.b2cVsB2b.b2b }}
            />
          </div>
        </div>

        {/* Status breakdown */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">Stav objednávek (celkem)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Stav</th>
                  <th className="px-4 py-2.5 text-right">Počet</th>
                  <th className="px-4 py-2.5 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {stats.statusBreakdown.map((s) => (
                  <tr key={s.status} className="border-t border-stone-100">
                    <td className="px-4 py-2.5 text-stone-700">{STATUS_LABELS[s.status] ?? s.status}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-stone-900">{s.count}</td>
                    <td className="px-4 py-2.5 text-right text-stone-500">{s.pct} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">Konverzní trychtýř (celkem)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Krok</th>
                  <th className="px-4 py-2.5 text-right">Počet objednávek</th>
                </tr>
              </thead>
              <tbody>
                {stats.conversionFunnel.map((f) => (
                  <tr key={f.status} className="border-t border-stone-100">
                    <td className="px-4 py-2.5 text-stone-700">{STATUS_LABELS[f.status] ?? f.status}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-stone-900">{f.count}</td>
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
