import { prisma } from '@/lib/prisma'
import {
  INVALID_STATUSES,
  pragueCurrentYear,
  pragueStartOfYear,
  pragueStartOfDay,
  pragueMonthOf,
  pragueDayOfWeek,
  pragueHourOf,
} from './helpers'

export type RevenueStats = {
  year: number
  totalThisYear: number
  totalLastYear: number
  byMonth: Array<{ month: number; revenue: number; orderCount: number }>
  lastYearByMonth: Array<{ month: number; revenue: number }>
  byDayOfWeek: Array<{ day: number; revenue: number; orderCount: number }>
  byHourOfDay: Array<{ hour: number; revenue: number; orderCount: number }>
}

export async function getRevenueStats(): Promise<RevenueStats> {
  const year = pragueCurrentYear()
  const thisYearStart = pragueStartOfYear(year)
  const lastYearStart = pragueStartOfYear(year - 1)
  const twelveMonthsAgo = pragueStartOfDay(-365)

  const [thisYearOrders, lastYearOrders, recentOrders] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: thisYearStart, lt: pragueStartOfYear(year + 1) }, status: { notIn: INVALID_STATUSES } },
      select: { createdAt: true, totalWithVat: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: lastYearStart, lt: thisYearStart }, status: { notIn: INVALID_STATUSES } },
      select: { createdAt: true, totalWithVat: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: twelveMonthsAgo }, status: { notIn: INVALID_STATUSES } },
      select: { createdAt: true, totalWithVat: true },
    }),
  ])

  const byMonthMap = new Map<number, { revenue: number; orderCount: number }>()
  for (let m = 1; m <= 12; m++) byMonthMap.set(m, { revenue: 0, orderCount: 0 })
  for (const o of thisYearOrders) {
    const m = pragueMonthOf(o.createdAt)
    const e = byMonthMap.get(m)!
    e.revenue += Number(o.totalWithVat)
    e.orderCount += 1
  }

  const lastYearByMonthMap = new Map<number, number>()
  for (let m = 1; m <= 12; m++) lastYearByMonthMap.set(m, 0)
  for (const o of lastYearOrders) {
    const m = pragueMonthOf(o.createdAt)
    lastYearByMonthMap.set(m, (lastYearByMonthMap.get(m) ?? 0) + Number(o.totalWithVat))
  }

  const byDowMap = new Map<number, { revenue: number; orderCount: number }>()
  for (let d = 0; d <= 6; d++) byDowMap.set(d, { revenue: 0, orderCount: 0 })
  for (const o of recentOrders) {
    const d = pragueDayOfWeek(o.createdAt)
    const e = byDowMap.get(d)!
    e.revenue += Number(o.totalWithVat)
    e.orderCount += 1
  }

  const byHourMap = new Map<number, { revenue: number; orderCount: number }>()
  for (let h = 0; h <= 23; h++) byHourMap.set(h, { revenue: 0, orderCount: 0 })
  for (const o of recentOrders) {
    const h = pragueHourOf(o.createdAt)
    const e = byHourMap.get(h)!
    e.revenue += Number(o.totalWithVat)
    e.orderCount += 1
  }

  return {
    year,
    totalThisYear: Math.round(thisYearOrders.reduce((s, o) => s + Number(o.totalWithVat), 0) * 100) / 100,
    totalLastYear: Math.round(lastYearOrders.reduce((s, o) => s + Number(o.totalWithVat), 0) * 100) / 100,
    byMonth: Array.from(byMonthMap.entries()).map(([month, v]) => ({
      month,
      revenue: Math.round(v.revenue * 100) / 100,
      orderCount: v.orderCount,
    })),
    lastYearByMonth: Array.from(lastYearByMonthMap.entries()).map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue * 100) / 100,
    })),
    byDayOfWeek: Array.from(byDowMap.entries()).map(([day, v]) => ({
      day,
      revenue: Math.round(v.revenue * 100) / 100,
      orderCount: v.orderCount,
    })),
    byHourOfDay: Array.from(byHourMap.entries()).map(([hour, v]) => ({
      hour,
      revenue: Math.round(v.revenue * 100) / 100,
      orderCount: v.orderCount,
    })),
  }
}
