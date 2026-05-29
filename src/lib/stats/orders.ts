import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { INVALID_STATUSES, pragueCurrentYear, pragueStartOfYear, pragueMonthOf } from './helpers'

export type OrdersStats = {
  year: number
  totalThisYear: number
  totalLastYear: number
  aovThisYear: number
  aovLastYear: number
  byMonth: Array<{ month: number; orderCount: number; revenue: number; aov: number }>
  statusBreakdown: Array<{ status: OrderStatus; count: number; pct: number }>
  pickupVsDelivery: { pickup: number; delivery: number }
  b2cVsB2b: { b2c: number; b2b: number }
  conversionFunnel: Array<{ status: OrderStatus; count: number }>
}

const FUNNEL_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED']

export async function getOrdersStats(): Promise<OrdersStats> {
  const year = pragueCurrentYear()
  const thisYearStart = pragueStartOfYear(year)
  const lastYearStart = pragueStartOfYear(year - 1)

  const [thisYearOrders, lastYearOrders, allOrders, pickupDelivery] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: thisYearStart, lt: pragueStartOfYear(year + 1) }, status: { notIn: INVALID_STATUSES } },
      select: { createdAt: true, totalWithVat: true, status: true, isBusinessOrder: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: lastYearStart, lt: thisYearStart }, status: { notIn: INVALID_STATUSES } },
      select: { totalWithVat: true },
    }),
    prisma.order.findMany({
      select: { status: true },
    }),
    prisma.order.findMany({
      select: { isBusinessOrder: true, shippingMethod: { select: { isPickup: true } } },
    }),
  ])

  // Monthly breakdown
  const byMonthMap = new Map<number, { count: number; revenue: number }>()
  for (let m = 1; m <= 12; m++) byMonthMap.set(m, { count: 0, revenue: 0 })
  for (const o of thisYearOrders) {
    const m = pragueMonthOf(o.createdAt)
    const e = byMonthMap.get(m)!
    e.count += 1
    e.revenue += Number(o.totalWithVat)
  }

  // Status breakdown
  const statusMap = new Map<OrderStatus, number>()
  for (const o of allOrders) {
    statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1)
  }
  const total = allOrders.length
  const statusBreakdown = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  // Pickup vs delivery
  let pickup = 0, delivery = 0
  for (const o of pickupDelivery) {
    if (o.shippingMethod?.isPickup) pickup++
    else delivery++
  }

  // B2C vs B2B
  let b2b = 0, b2c = 0
  for (const o of thisYearOrders) {
    if (o.isBusinessOrder) b2b++
    else b2c++
  }

  // Totals
  const totalThisYear = thisYearOrders.length
  const revenueThisYear = thisYearOrders.reduce((s, o) => s + Number(o.totalWithVat), 0)
  const totalLastYear = lastYearOrders.length
  const revenueLastYear = lastYearOrders.reduce((s, o) => s + Number(o.totalWithVat), 0)

  // Conversion funnel (from all-time)
  const funnelMap = new Map<OrderStatus, number>()
  for (const o of allOrders) {
    funnelMap.set(o.status, (funnelMap.get(o.status) ?? 0) + 1)
  }
  const conversionFunnel = FUNNEL_STATUSES.map(s => ({ status: s, count: funnelMap.get(s) ?? 0 }))

  return {
    year,
    totalThisYear,
    totalLastYear,
    aovThisYear: totalThisYear > 0 ? Math.round(revenueThisYear / totalThisYear * 100) / 100 : 0,
    aovLastYear: totalLastYear > 0 ? Math.round(revenueLastYear / totalLastYear * 100) / 100 : 0,
    byMonth: Array.from(byMonthMap.entries()).map(([month, v]) => ({
      month,
      orderCount: v.count,
      revenue: Math.round(v.revenue * 100) / 100,
      aov: v.count > 0 ? Math.round(v.revenue / v.count * 100) / 100 : 0,
    })),
    statusBreakdown,
    pickupVsDelivery: { pickup, delivery },
    b2cVsB2b: { b2c, b2b },
    conversionFunnel,
  }
}
