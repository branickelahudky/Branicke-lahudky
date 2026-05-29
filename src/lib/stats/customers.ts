import { prisma } from '@/lib/prisma'
import { INVALID_STATUSES, pragueCurrentYear, pragueStartOfYear } from './helpers'

export type CustomersStats = {
  year: number
  newCustomers: number
  returningCustomers: number
  avgCLV: number
  topCustomers: Array<{
    customerId: string
    firstName: string
    lastName: string
    email: string
    orderCount: number
    totalSpent: number
    aov: number
  }>
  topPSC: Array<{ postalCode: string; city: string; orderCount: number }>
}

export async function getCustomersStats(): Promise<CustomersStats> {
  const year = pragueCurrentYear()
  const yearStart = pragueStartOfYear(year)
  const yearEnd = pragueStartOfYear(year + 1)

  const [yearOrders, allCustomerOrders, pscRaw] = await Promise.all([
    // Orders this year with customer info
    prisma.order.findMany({
      where: { createdAt: { gte: yearStart, lt: yearEnd }, status: { notIn: INVALID_STATUSES } },
      select: { customerId: true, totalWithVat: true },
    }),
    // All orders grouped by customer for CLV
    prisma.order.findMany({
      where: { customerId: { not: null }, status: { notIn: INVALID_STATUSES } },
      select: { customerId: true, totalWithVat: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    // PSČ from shipping snapshot — raw to avoid loading all JSON
    prisma.$queryRaw<Array<{ postalCode: string; city: string; cnt: bigint }>>`
      SELECT
        "shippingAddressSnapshot"->>'postalCode' AS "postalCode",
        "shippingAddressSnapshot"->>'city' AS "city",
        COUNT(*) AS cnt
      FROM "Order"
      WHERE status NOT IN ('CANCELLED', 'REFUNDED')
        AND "shippingAddressSnapshot"->>'postalCode' IS NOT NULL
      GROUP BY "postalCode", "city"
      ORDER BY cnt DESC
      LIMIT 10
    `,
  ])

  // New vs returning in this year
  // "New" = customer's first order ever is in this year
  const firstOrderYear = new Map<string, number>()
  for (const o of allCustomerOrders) {
    if (!o.customerId) continue
    const orderYear = o.createdAt.getFullYear()
    const existing = firstOrderYear.get(o.customerId)
    if (existing === undefined || orderYear < existing) {
      firstOrderYear.set(o.customerId, orderYear)
    }
  }

  let newCustomers = 0, returningCustomers = 0
  const seenThisYear = new Set<string>()
  for (const o of yearOrders) {
    if (!o.customerId) continue
    if (seenThisYear.has(o.customerId)) continue
    seenThisYear.add(o.customerId)
    if (firstOrderYear.get(o.customerId) === year) newCustomers++
    else returningCustomers++
  }
  // Guest orders (no customerId) count as new
  const guestOrders = yearOrders.filter(o => !o.customerId).length
  newCustomers += guestOrders

  // CLV: total spent per customer (all time)
  const clvMap = new Map<string, number>()
  for (const o of allCustomerOrders) {
    if (!o.customerId) continue
    clvMap.set(o.customerId, (clvMap.get(o.customerId) ?? 0) + Number(o.totalWithVat))
  }
  const clvValues = Array.from(clvMap.values())
  const avgCLV = clvValues.length > 0 ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : 0

  // Top customers
  const customerOrderMap = new Map<string, { count: number; total: number }>()
  for (const o of allCustomerOrders) {
    if (!o.customerId) continue
    const e = customerOrderMap.get(o.customerId)
    if (e) { e.count++; e.total += Number(o.totalWithVat) }
    else customerOrderMap.set(o.customerId, { count: 1, total: Number(o.totalWithVat) })
  }
  const topCustomerIds = Array.from(customerOrderMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([id]) => id)

  const customerDetails = await prisma.customer.findMany({
    where: { id: { in: topCustomerIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  const customerDetailMap = new Map(customerDetails.map(c => [c.id, c]))

  const topCustomers = topCustomerIds.map(id => {
    const stats = customerOrderMap.get(id)!
    const c = customerDetailMap.get(id)
    return {
      customerId: id,
      firstName: c?.firstName ?? '',
      lastName: c?.lastName ?? '',
      email: c?.email ?? '',
      orderCount: stats.count,
      totalSpent: Math.round(stats.total * 100) / 100,
      aov: Math.round(stats.total / stats.count * 100) / 100,
    }
  })

  const topPSC = pscRaw.map(r => ({
    postalCode: r.postalCode ?? '',
    city: r.city ?? '',
    orderCount: Number(r.cnt),
  }))

  return {
    year,
    newCustomers,
    returningCustomers,
    avgCLV: Math.round(avgCLV * 100) / 100,
    topCustomers,
    topPSC,
  }
}
