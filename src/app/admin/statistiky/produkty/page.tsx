import Link from 'next/link'
import { getProductsStats } from '@/lib/stats/products'
import { formatCZK } from '@/lib/pricing'
import { pragueCurrentYear } from '@/lib/stats/helpers'
import { CategoryRevenueChart } from '../_components/CategoryRevenueChart'

export default async function StatistikyProduktyPage() {
  const stats = await getProductsStats()
  const year = pragueCurrentYear()

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-6 py-3 backdrop-blur">
        <h2 className="text-sm font-medium text-stone-700">Produkty</h2>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">

        {/* Kategorie */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-stone-700">Tržby podle kategorií — {year}</h3>
          <CategoryRevenueChart data={stats.categoryRevenue} />
          {stats.categoryRevenue.length === 0 && (
            <p className="text-center text-sm text-stone-400 py-4">Zatím žádná data pro kategorie.</p>
          )}
        </div>

        {/* Bestsellery */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* TOP 20 podle množství */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-stone-700">TOP 20 — prodané množství ({year})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2 text-right w-8">#</th>
                    <th className="px-4 py-2 text-left">Produkt</th>
                    <th className="px-4 py-2 text-right">Množství</th>
                    <th className="px-4 py-2 text-right">Tržby</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bestSellersByQuantity.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">Žádná data</td></tr>
                  )}
                  {stats.bestSellersByQuantity.map((p, i) => (
                    <tr key={p.productId ?? p.name} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-2 text-right text-stone-400">{i + 1}</td>
                      <td className="px-4 py-2 text-stone-700">
                        {p.productId ? (
                          <Link href={`/admin/produkty/${p.productId}`} className="hover:text-blue-600 hover:underline">{p.name}</Link>
                        ) : p.name}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-stone-900">{p.quantitySold % 1 === 0 ? p.quantitySold : p.quantitySold.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{formatCZK(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOP 20 podle tržeb */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-stone-700">TOP 20 — tržby ({year})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2 text-right w-8">#</th>
                    <th className="px-4 py-2 text-left">Produkt</th>
                    <th className="px-4 py-2 text-right">Tržby</th>
                    <th className="px-4 py-2 text-right">Množství</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bestSellersByRevenue.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">Žádná data</td></tr>
                  )}
                  {stats.bestSellersByRevenue.map((p, i) => (
                    <tr key={p.productId ?? p.name} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-2 text-right text-stone-400">{i + 1}</td>
                      <td className="px-4 py-2 text-stone-700">
                        {p.productId ? (
                          <Link href={`/admin/produkty/${p.productId}`} className="hover:text-blue-600 hover:underline">{p.name}</Link>
                        ) : p.name}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-stone-900">{formatCZK(p.revenue)}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{p.quantitySold % 1 === 0 ? p.quantitySold : p.quantitySold.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Worst sellers */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-stone-700">Kandidáti na vyřazení — bez prodeje za 90 dní</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Produkt</th>
                  <th className="px-4 py-2.5 text-right">Skladem</th>
                </tr>
              </thead>
              <tbody>
                {stats.worstSellers.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-stone-400">Všechny produkty se prodávaly v posledních 90 dnech.</td></tr>
                )}
                {stats.worstSellers.map((p) => (
                  <tr key={p.productId} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/produkty/${p.productId}`} className="text-stone-700 hover:text-blue-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{p.stockQuantity} ks</td>
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
