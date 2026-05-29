import { getRevenueStats } from '@/lib/stats/revenue'
import { formatCZK } from '@/lib/pricing'
import { MonthlyRevenueChart, DayOfWeekChart, HourOfDayChart } from './_components/RevenueCharts'

const MONTH_NAMES = ['', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']

export default async function StatistikyPage() {
  const stats = await getRevenueStats()
  const deltaRevenue = stats.totalLastYear > 0
    ? Math.round(((stats.totalThisYear - stats.totalLastYear) / stats.totalLastYear) * 100)
    : null

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-700">Obrat a tržby</h2>
          <a
            href="/api/statistiky/revenue/export"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            Stáhnout CSV
          </a>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">

        {/* Velká metrika */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Tržby {stats.year}</p>
          <div className="mt-2 flex items-baseline gap-4">
            <p className="text-4xl font-bold text-stone-900">{formatCZK(stats.totalThisYear)}</p>
            {deltaRevenue !== null && (
              <span className={`text-sm font-medium ${deltaRevenue >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {deltaRevenue >= 0 ? '↑' : '↓'}{Math.abs(deltaRevenue)} % vs. {stats.year - 1}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-400">{stats.year - 1}: {formatCZK(stats.totalLastYear)}</p>
        </div>

        {/* Měsíční graf */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-stone-700">Tržby po měsících — {stats.year} vs {stats.year - 1}</h3>
          <MonthlyRevenueChart thisYear={stats.byMonth} lastYear={stats.lastYearByMonth} />
        </div>

        {/* Měsíční tabulka */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">Přehled po měsících — {stats.year}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Měsíc</th>
                  <th className="px-4 py-2.5 text-right">Tržby</th>
                  <th className="px-4 py-2.5 text-right">Objednávky</th>
                  <th className="px-4 py-2.5 text-right">AOV</th>
                  <th className="px-4 py-2.5 text-right">Loni</th>
                </tr>
              </thead>
              <tbody>
                {stats.byMonth.map((m) => {
                  const ly = stats.lastYearByMonth.find(r => r.month === m.month)
                  return (
                    <tr key={m.month} className="border-t border-stone-100">
                      <td className="px-4 py-2.5 text-stone-700">{MONTH_NAMES[m.month]}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-stone-900">{formatCZK(m.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-stone-600">{m.orderCount}</td>
                      <td className="px-4 py-2.5 text-right text-stone-600">{m.orderCount > 0 ? formatCZK(Math.round(m.revenue / m.orderCount)) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-stone-400">{formatCZK(ly?.revenue ?? 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grafy den v týdnu + hodina */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-stone-700">Tržby podle dne v týdnu</h3>
            <p className="mb-4 text-xs text-stone-400">Posledních 12 měsíců</p>
            <DayOfWeekChart data={stats.byDayOfWeek} />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-stone-700">Tržby podle hodiny dne</h3>
            <p className="mb-4 text-xs text-stone-400">Posledních 12 měsíců</p>
            <HourOfDayChart data={stats.byHourOfDay} />
          </div>
        </div>

        {stats.totalThisYear === 0 && (
          <p className="text-center text-sm text-stone-400 py-4">
            Zatím málo dat. Statistiky se naplní s rostoucím provozem.
          </p>
        )}

      </div>
    </div>
  )
}
