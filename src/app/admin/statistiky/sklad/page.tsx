import Link from 'next/link'
import { getStockStats } from '@/lib/stats/stock'

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short' }).format(d)
}

export default async function StatistikySkladPage() {
  const stats = await getStockStats()

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <h2 className="text-sm font-medium text-stone-700">Sklad</h2>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">

        {/* Metriky */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl border p-4 shadow-sm ${stats.lowStock.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${stats.lowStock.length > 0 ? 'text-amber-700' : 'text-stone-500'}`}>
              Nízký sklad (&lt;5 ks)
            </p>
            <p className={`mt-2 text-3xl font-bold ${stats.lowStock.length > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
              {stats.lowStock.length}
            </p>
          </div>
          <div className={`rounded-xl border p-4 shadow-sm ${stats.deadStock.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-stone-200 bg-white'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${stats.deadStock.length > 0 ? 'text-orange-700' : 'text-stone-500'}`}>
              Mrtvý sklad
            </p>
            <p className={`mt-2 text-3xl font-bold ${stats.deadStock.length > 0 ? 'text-orange-800' : 'text-stone-900'}`}>
              {stats.deadStock.length}
            </p>
            <p className={`mt-1 text-xs ${stats.deadStock.length > 0 ? 'text-orange-600' : 'text-stone-400'}`}>
              Skladem, ale bez prodeje 30 dní
            </p>
          </div>
        </div>

        {/* Low stock tabulka */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">Nízký sklad — pod 5 kusů</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Produkt</th>
                  <th className="px-4 py-2.5 text-right">Skladem</th>
                  <th className="px-4 py-2.5 text-right">Prodáno (30 dní)</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStock.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400">Žádný produkt s nízkým skladem. Dobrá práce!</td></tr>
                )}
                {stats.lowStock.map((p) => (
                  <tr key={p.productId} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/produkty/${p.productId}`} className="text-stone-700 hover:text-blue-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${p.stockQuantity <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                      {p.stockQuantity} ks
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{p.soldLast30} ks</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fast movers */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">TOP 20 nejrychleji rotujících produktů (90 dní)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-right w-8">#</th>
                  <th className="px-4 py-2.5 text-left">Produkt</th>
                  <th className="px-4 py-2.5 text-right">Prodáno (90 dní)</th>
                  <th className="px-4 py-2.5 text-right">Skladem</th>
                  <th className="px-4 py-2.5 text-right">Vydrží dnů</th>
                </tr>
              </thead>
              <tbody>
                {stats.fastMovers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">Žádná data</td></tr>
                )}
                {stats.fastMovers.map((p, i) => (
                  <tr key={p.productId} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-2.5 text-right text-stone-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/produkty/${p.productId}`} className="text-stone-700 hover:text-blue-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-stone-900">{p.soldLast90} ks</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{p.stockQuantity} ks</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${p.turnoverDays <= 7 ? 'text-red-600' : p.turnoverDays <= 14 ? 'text-amber-600' : 'text-stone-600'}`}>
                      {p.turnoverDays === 999 ? '—' : p.turnoverDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dead stock */}
        {stats.deadStock.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-stone-700">
                Mrtvý sklad — bez prodeje za 30 dní ({stats.deadStock.length} produktů)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Produkt</th>
                    <th className="px-4 py-2.5 text-right">Skladem</th>
                    <th className="px-4 py-2.5 text-right">Poslední prodej (90 dní)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.deadStock.map((p) => (
                    <tr key={p.productId} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/produkty/${p.productId}`} className="text-stone-700 hover:text-blue-600 hover:underline">{p.name}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-600">{p.stockQuantity} ks</td>
                      <td className="px-4 py-2.5 text-right text-stone-400">{fmtDate(p.lastOrderDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
