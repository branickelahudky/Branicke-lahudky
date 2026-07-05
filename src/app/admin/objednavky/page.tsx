import Link from 'next/link'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatCZK } from '@/lib/pricing'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { StatusDropdown } from './StatusDropdown'
import { computeCustomerRating, ratingEmoji, ratingColorClass } from '@/lib/customer-rating'
import { computeAllowedStatuses } from '@/lib/order-status'

const PAGE_SIZE = 50

// Mapování URL parametru → filtrovací stavy
const TAB_FILTER: Record<string, OrderStatus[]> = {
  nevyrizena: ['PENDING', 'CONFIRMED'],
  'vyrizuje-se': ['PROCESSING', 'READY'],
  vyrizena: ['SHIPPED', 'DELIVERED'],
  stornovana: ['CANCELLED', 'REFUNDED'],
}

const TABS = [
  { key: 'vse', label: 'Všechny' },
  { key: 'stornovana', label: 'Stornována' },
  { key: 'vyrizena', label: 'Vyřízena' },
  { key: 'vyrizuje-se', label: 'Vyřizuje se' },
  { key: 'nevyrizena', label: 'Nevyřízená' },
]

interface Props {
  searchParams: Promise<{
    stav?: string
    strana?: string
    sort?: string
    order?: string
    platba?: string
  }>
}

export default async function ObjednavkyPage({ searchParams }: Props) {
  const { user } = await requireAuth()
  const params = await searchParams

  const stav = params.stav ?? 'vse'
  const strana = Math.max(1, parseInt(params.strana ?? '1') || 1)
  const sort = params.sort ?? 'createdAt'
  const dir = (params.order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  const statusFilter = TAB_FILTER[stav]

  // Filtr stavu platby (?platba=zaplaceno|ceka|nezaplaceno)
  const platba = params.platba ?? 'vse'
  const PAYMENT_FILTER: Record<string, { in: ('PAID' | 'PENDING' | 'UNPAID' | 'FAILED')[] } | undefined> = {
    zaplaceno: { in: ['PAID'] },
    ceka: { in: ['PENDING'] },
    nezaplaceno: { in: ['UNPAID', 'FAILED'] },
  }
  const paymentFilter = PAYMENT_FILTER[platba]
  const whereClause = {
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
    ...(paymentFilter ? { paymentStatus: paymentFilter } : {}),
  }

  const orderBy =
    sort === 'totalWithVat'
      ? { totalWithVat: dir }
      : sort === 'contactLastName'
        ? { contactLastName: dir }
        : { createdAt: dir }

  // Paralelní dotazy: objednávky + celkový počet + počty záložek
  const [orders, total, tabCounts] = await Promise.all([
    prisma.order.findMany({
      where: whereClause,
      orderBy,
      take: PAGE_SIZE,
      skip: (strana - 1) * PAGE_SIZE,
      include: {
        shippingMethod: { select: { name: true } },
        paymentMethod: { select: { name: true } },
        _count: { select: { notes: true } },
      },
    }),
    prisma.order.count({ where: whereClause }),
    Promise.all(
      TABS.map(({ key }) => {
        const filter = TAB_FILTER[key]
        return filter
          ? prisma.order.count({ where: { status: { in: filter } } })
          : prisma.order.count()
      })
    ),
  ])

  // Batch customer rating — jeden dotaz pro všechny zákazníky na stránce
  const customerIds = [
    ...new Set(orders.map((o) => o.customerId).filter((id): id is string => id !== null)),
  ]
  const customerOrderStatuses =
    customerIds.length > 0
      ? await prisma.order.findMany({
          where: { customerId: { in: customerIds } },
          select: { customerId: true, status: true },
        })
      : []

  const ratingByCustomerId = new Map(
    customerIds.map((id) => [
      id,
      computeCustomerRating(
        customerOrderStatuses.filter((o) => o.customerId === id).map((o) => o.status),
      ),
    ]),
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Pomocníci pro URL generování (sort + tab + paginace zachovávají ostatní parametry)
  function tabHref(key: string) {
    return `/admin/objednavky?stav=${key}${platba !== 'vse' ? `&platba=${platba}` : ''}`
  }
  function sortHref(column: string) {
    const newDir = sort === column && dir === 'asc' ? 'desc' : 'asc'
    return `/admin/objednavky?stav=${stav}&sort=${column}&order=${newDir}`
  }
  function pageHref(n: number) {
    return `/admin/objednavky?stav=${stav}${platba !== 'vse' ? `&platba=${platba}` : ''}&strana=${n}&sort=${sort}&order=${dir}`
  }
  function SortArrow({ column }: { column: string }) {
    if (sort !== column) return <span className="ml-0.5 text-stone-300">↕</span>
    return <span className="ml-0.5 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/objednavky" />

      <div className="flex flex-1 flex-col">
        <AdminHeader title="Přehled objednávek" user={user} />

        <main className="flex-1 p-6">
          <div className="rounded-lg border border-stone-200 bg-white">

            {/* Záložky */}
            <div className="flex border-b border-stone-200">
              {TABS.map(({ key, label }, i) => {
                const isActive = stav === key
                const count = tabCounts[i]
                return (
                  <Link
                    key={key}
                    href={tabHref(key)}
                    className={`relative px-4 py-3 text-sm transition ${
                      isActive
                        ? 'font-semibold text-stone-900'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-green-500" />
                    )}
                    {label}
                    <span
                      className={`ml-1.5 rounded px-1.5 py-0.5 text-xs ${
                        isActive ? 'bg-stone-100 text-stone-700' : 'text-stone-400'
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                )
              })}
              {/* Filtr platby */}
              <div className="ml-auto flex items-center gap-1 px-3 py-2 text-xs">
                <span className="mr-1 text-stone-400">Platba:</span>
                {[
                  { key: 'vse', label: 'Vše' },
                  { key: 'zaplaceno', label: 'Zaplaceno' },
                  { key: 'ceka', label: 'Čeká na platbu' },
                  { key: 'nezaplaceno', label: 'Nezaplaceno' },
                ].map((t) => (
                  <Link
                    key={t.key}
                    href={`/admin/objednavky?stav=${stav}${t.key !== 'vse' ? `&platba=${t.key}` : ''}`}
                    className={`rounded-full px-2.5 py-1 transition ${
                      platba === t.key
                        ? 'bg-stone-800 font-medium text-white'
                        : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Panel nástrojů */}
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <select className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600">
                <option>FUNKCE</option>
                <option disabled>── Hromadné akce ──</option>
                <option>Označit jako Vyřídeno</option>
                <option>Označit jako Stornováno</option>
                <option>Exportovat CSV</option>
              </select>
              <button className="flex items-center gap-1.5 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                FILTR
              </button>
            </div>

            {/* Tabulka */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs text-stone-500">
                  <tr>
                    <th className="w-8 p-3">
                      <input type="checkbox" className="rounded" />
                    </th>
                    <th className="p-3">
                      <Link href={sortHref('createdAt')} className="flex items-center hover:text-stone-700">
                        Kód a datum <SortArrow column="createdAt" />
                      </Link>
                    </th>
                    <th className="p-3">
                      <Link href={sortHref('contactLastName')} className="flex items-center hover:text-stone-700">
                        Zákazník <SortArrow column="contactLastName" />
                      </Link>
                    </th>
                    <th className="p-3">Doprava</th>
                    <th className="p-3">Platba</th>
                    <th className="p-3">Kanál</th>
                    <th className="p-3">Stav</th>
                    <th className="p-3 text-right">
                      <Link href={sortHref('totalWithVat')} className="flex items-center justify-end hover:text-stone-700">
                        Cena <SortArrow column="totalWithVat" />
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-stone-400">
                        Žádné objednávky nenalezeny.
                      </td>
                    </tr>
                  )}
                  {orders.map((order) => {
                    const isCancelled =
                      order.status === 'CANCELLED' || order.status === 'REFUNDED'
                    const hasNotes = order._count.notes > 0
                    const rating = order.customerId
                      ? ratingByCustomerId.get(order.customerId) ?? null
                      : null
                    const rowAllowedStatuses = computeAllowedStatuses(order.status, user.role)

                    return (
                      <tr
                        key={order.id}
                        className={`border-t border-stone-100 hover:bg-stone-50 ${
                          isCancelled ? 'italic text-stone-400' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3">
                          <input type="checkbox" className="rounded" />
                        </td>

                        {/* Kód a datum */}
                        <td className="p-3">
                          <Link
                            href={`/admin/objednavky/${order.id}`}
                            className={`font-mono text-sm font-medium ${
                              isCancelled ? 'text-stone-400' : 'text-blue-600 hover:underline'
                            }`}
                          >
                            {order.orderNumber}
                          </Link>
                          <p className="mt-0.5 text-xs text-stone-400">
                            {new Intl.DateTimeFormat('cs-CZ', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(order.createdAt)}
                          </p>
                        </td>

                        {/* Zákazník + ikony */}
                        <td className="p-3">
                          <span>
                            {order.contactFirstName} {order.contactLastName}
                          </span>
                          <span className="ml-2 inline-flex items-center gap-1">
                            {hasNotes && (
                              <span
                                title="Má interní poznámku"
                                className="inline-flex h-4 w-4 items-center justify-center rounded bg-orange-100 text-[10px] font-bold text-orange-600"
                              >
                                P
                              </span>
                            )}
                            {rating && (
                              <span
                                title={
                                  rating === 'good'
                                    ? 'Dobrý zákazník (5+ vyřízených)'
                                    : rating === 'bad'
                                      ? 'Rizikový zákazník (50%+ storno)'
                                      : 'Průměrný zákazník'
                                }
                                className={`text-base leading-none ${ratingColorClass(rating)}`}
                              >
                                {ratingEmoji(rating)}
                              </span>
                            )}
                          </span>
                        </td>

                        {/* Doprava */}
                        <td className="p-3 text-stone-600">
                          {order.shippingMethod?.name ?? order.shippingMethodName}
                        </td>

                        {/* Platba */}
                        <td className="p-3">
                          <span className="flex flex-col gap-0.5">
                            <span className="text-stone-600">
                              {order.paymentMethod?.name ?? order.paymentMethodName}
                            </span>
                            {order.paymentStatus === 'PAID' ? (
                              <span className="w-fit rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Zaplaceno</span>
                            ) : order.paymentStatus === 'PENDING' ? (
                              <span className="w-fit rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Čeká na platbu</span>
                            ) : order.paymentStatus === 'FAILED' ? (
                              <span className="w-fit rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Selhala</span>
                            ) : (
                              <span className="w-fit rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">Nezaplaceno</span>
                            )}
                          </span>
                        </td>

                        {/* Prodejní kanál */}
                        <td className="p-3 text-stone-500">E-shop</td>

                        {/* Stav — dropdown */}
                        <td className="p-3">
                          <StatusDropdown
                            orderId={order.id}
                            currentStatus={order.status}
                            allowedStatuses={rowAllowedStatuses}
                          />
                        </td>

                        {/* Cena */}
                        <td className={`p-3 text-right font-semibold ${isCancelled ? 'text-stone-400' : 'text-stone-900'}`}>
                          {formatCZK(Number(order.totalWithVat))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginace */}
            <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-stone-500">
              <span>
                Strana {strana} z {totalPages},{' '}
                <span className="font-medium text-stone-700">{total}</span> položek celkem
              </span>
              <div className="flex gap-2">
                {strana > 1 && (
                  <Link
                    href={pageHref(strana - 1)}
                    className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50"
                  >
                    ← Předchozí
                  </Link>
                )}
                {strana < totalPages && (
                  <Link
                    href={pageHref(strana + 1)}
                    className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50"
                  >
                    Další →
                  </Link>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
