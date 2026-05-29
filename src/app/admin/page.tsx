import Link from 'next/link'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { getDashboardStats } from '@/lib/dashboard-stats'
import { formatCZK } from '@/lib/pricing'
import { RevenueChart } from './RevenueChart'
import { STATUS_LABELS } from '@/lib/order-status'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-indigo-100 text-indigo-800',
  READY: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-cyan-100 text-cyan-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-stone-100 text-stone-500',
  REFUNDED: 'bg-stone-100 text-stone-500',
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

function DeltaChip({ current, prev, unit = '' }: { current: number; prev: number; unit?: string }) {
  if (prev === 0 && current === 0) return <span className="text-stone-400 text-xs">— žádná data</span>
  const diff = current - prev
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : null
  const up = diff >= 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      <span>{up ? '↑' : '↓'}</span>
      {pct !== null ? `${Math.abs(pct)} %` : ''}
      {unit && <span className="ml-1 font-normal text-stone-500">Včera: {unit}{formatCZK(prev)}</span>}
    </span>
  )
}

export default async function AdminDashboard() {
  const { user } = await requireAuth()
  const stats = await getDashboardStats()

  const attention = stats.needsAttention
  const attentionTotal = attention.pendingOrders + attention.overdueInvoices + attention.lowStockProducts
  const monthDeltaPct = stats.lastMonth.revenue > 0
    ? Math.round(((stats.thisMonth.revenue - stats.lastMonth.revenue) / stats.lastMonth.revenue) * 100)
    : null

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Základní přehled" user={user} />

        <main className="flex-1 overflow-auto p-4 sm:p-6">

          {/* ── UPOZORNĚNÍ ── */}
          {(attention.overdueInvoices > 0 || attention.lowStockProducts > 0) && (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              {attention.overdueInvoices > 0 && (
                <Link
                  href="/admin/faktury"
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-100 transition"
                >
                  <span>⚠️</span>
                  <span>
                    <strong>{attention.overdueInvoices}</strong>{' '}
                    {attention.overdueInvoices === 1 ? 'faktura je' : attention.overdueInvoices < 5 ? 'faktury jsou' : 'faktur je'} po splatnosti
                  </span>
                  <span className="ml-1 text-amber-600">→ zobrazit</span>
                </Link>
              )}
              {attention.lowStockProducts > 0 && (
                <Link
                  href="/admin/produkty"
                  className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800 hover:bg-orange-100 transition"
                >
                  <span>📦</span>
                  <span>
                    <strong>{attention.lowStockProducts}</strong>{' '}
                    {attention.lowStockProducts === 1 ? 'produkt má' : attention.lowStockProducts < 5 ? 'produkty mají' : 'produktů má'} málo skladem
                  </span>
                  <span className="ml-1 text-orange-600">→ zobrazit</span>
                </Link>
              )}
            </div>
          )}

          {/* ── METRIKY — 4 karty ── */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">

            {/* Dnes objednávek */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Dnes objednávek</p>
              <p className="mt-2 text-3xl font-bold text-stone-900">{stats.today.orderCount}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                <span>Včera: {stats.yesterday.orderCount}</span>
                {stats.yesterday.orderCount !== stats.today.orderCount && (
                  <span className={stats.today.orderCount >= stats.yesterday.orderCount ? 'text-green-600' : 'text-red-500'}>
                    {stats.today.orderCount >= stats.yesterday.orderCount ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </div>

            {/* Tržby dnes */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Tržby dnes</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">{formatCZK(stats.today.revenue)}</p>
              <div className="mt-1 text-xs text-stone-500">
                Včera: {formatCZK(stats.yesterday.revenue)}
                {stats.yesterday.revenue > 0 && (
                  <span className={`ml-1.5 font-medium ${stats.today.revenue >= stats.yesterday.revenue ? 'text-green-600' : 'text-red-500'}`}>
                    {stats.today.revenue >= stats.yesterday.revenue ? '↑' : '↓'}
                    {Math.abs(Math.round(((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100))} %
                  </span>
                )}
              </div>
            </div>

            {/* Tento měsíc */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Tento měsíc</p>
              <p className="mt-2 text-2xl font-bold text-stone-900">{formatCZK(stats.thisMonth.revenue)}</p>
              <div className="mt-1 text-xs text-stone-500">
                {stats.thisMonth.orderCount} objednávek
                {monthDeltaPct !== null && (
                  <span className={`ml-1.5 font-medium ${monthDeltaPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {monthDeltaPct >= 0 ? '↑' : '↓'}{Math.abs(monthDeltaPct)} % vs. min. měsíc
                  </span>
                )}
              </div>
            </div>

            {/* Vyžaduje pozornost */}
            <div className={`rounded-xl border p-4 shadow-sm ${
              attentionTotal > 0
                ? 'border-amber-200 bg-amber-50'
                : 'border-stone-200 bg-white'
            }`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${attentionTotal > 0 ? 'text-amber-700' : 'text-stone-500'}`}>
                Vyžaduje pozornost
              </p>
              <p className={`mt-2 text-3xl font-bold ${attentionTotal > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
                {attentionTotal}
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-stone-500">
                {attention.pendingOrders > 0 && (
                  <p className="text-amber-700">{attention.pendingOrders} objednávek čeká</p>
                )}
                {attention.overdueInvoices > 0 && (
                  <p className="text-red-600">{attention.overdueInvoices} faktur po splatnosti</p>
                )}
                {attention.lowStockProducts > 0 && (
                  <p className="text-orange-600">{attention.lowStockProducts} produktů dochází</p>
                )}
                {attentionTotal === 0 && <p className="text-green-600">Vše v pořádku ✓</p>}
              </div>
            </div>
          </div>

          {/* ── GRAF TRŽEB ── */}
          <div className="mb-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-stone-700">Tržby — posledních 30 dní</h2>
            <RevenueChart data={stats.revenueChart} />
          </div>

          {/* ── SPODNÍ SEKCE ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

            {/* Poslední objednávky (3/5) */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm lg:col-span-3">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-stone-700">Poslední objednávky</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-xs text-stone-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Číslo</th>
                      <th className="px-4 py-2.5 text-left">Zákazník</th>
                      <th className="px-4 py-2.5 text-right">Cena</th>
                      <th className="px-4 py-2.5 text-left">Stav</th>
                      <th className="px-4 py-2.5 text-left">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.latestOrders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                          Zatím žádné objednávky.
                        </td>
                      </tr>
                    )}
                    {stats.latestOrders.map((o) => (
                      <tr
                        key={o.id}
                        className="border-t border-stone-100 transition hover:bg-stone-50"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/objednavky/${o.id}`}
                            className="font-mono text-blue-600 hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-2.5 text-stone-700">
                          {o.customerName}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-stone-900">
                          {formatCZK(o.totalWithVat)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status] ?? 'bg-stone-100 text-stone-600'}`}>
                            {STATUS_LABELS[o.status] ?? o.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-stone-500">
                          {fmtDate(o.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-stone-100 px-5 py-3">
                <Link
                  href="/admin/objednavky"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Zobrazit všechny objednávky →
                </Link>
              </div>
            </div>

            {/* TOP 5 produktů (2/5) */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm lg:col-span-2">
              <div className="border-b border-stone-100 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-stone-700">TOP 5 produktů (30 dní)</h2>
              </div>
              <div className="divide-y divide-stone-100">
                {stats.topProducts.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-stone-400">
                    Žádná data.
                  </p>
                )}
                {stats.topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">{p.name}</p>
                      <p className="text-xs text-stone-500">
                        {p.quantitySold % 1 === 0
                          ? p.quantitySold
                          : p.quantitySold.toFixed(2)} ks · {formatCZK(p.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
