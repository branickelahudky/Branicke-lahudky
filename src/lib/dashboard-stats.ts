import { OrderStatus } from '@prisma/client'
import { prisma } from './prisma'

const INVALID_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED']
const PENDING_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING']

// Vrátí začátek dne v časové zóně Europe/Prague jako UTC Date
function pragueStartOfDay(offsetDays = 0): Date {
  const now = new Date()
  // Formátujeme v Prague TZ, pak parsujeme jako půlnoc UTC
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const y = parseInt(parts.find((p) => p.type === 'year')!.value)
  const m = parseInt(parts.find((p) => p.type === 'month')!.value) - 1
  const d = parseInt(parts.find((p) => p.type === 'day')!.value)
  const date = new Date(Date.UTC(y, m, d + offsetDays))
  // Prague is UTC+1 (winter) / UTC+2 (summer) — shift back to get local midnight in UTC
  // We interpret the formatted date as local Prague midnight
  const pragueOffset = getPragueOffsetMs(date)
  return new Date(date.getTime() - pragueOffset)
}

function getPragueOffsetMs(date: Date): number {
  // Get Prague TZ offset by comparing UTC with Prague local time
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const pragueStr = date.toLocaleString('en-US', { timeZone: 'Europe/Prague' })
  const diff = new Date(pragueStr).getTime() - new Date(utcStr).getTime()
  return diff
}

function pragueStartOfMonth(offsetMonths = 0): Date {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const y = parseInt(parts.find((p) => p.type === 'year')!.value)
  const m = parseInt(parts.find((p) => p.type === 'month')!.value) - 1 + offsetMonths
  const date = new Date(Date.UTC(y, m, 1))
  const pragueOffset = getPragueOffsetMs(date)
  return new Date(date.getTime() - pragueOffset)
}

export type DashboardStats = {
  today: { orderCount: number; revenue: number }
  yesterday: { orderCount: number; revenue: number }
  thisMonth: { orderCount: number; revenue: number }
  lastMonth: { revenue: number }
  needsAttention: {
    pendingOrders: number
    overdueInvoices: number
    lowStockProducts: number
  }
  revenueChart: Array<{ date: string; revenue: number; orderCount: number }>
  topProducts: Array<{
    productId: string
    name: string
    quantitySold: number
    revenue: number
  }>
  latestOrders: Array<{
    id: string
    orderNumber: string
    customerName: string
    totalWithVat: number
    status: OrderStatus
    createdAt: Date
  }>
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayStart = pragueStartOfDay(0)
  const tomorrowStart = pragueStartOfDay(1)
  const yesterdayStart = pragueStartOfDay(-1)
  const thisMonthStart = pragueStartOfMonth(0)
  const lastMonthStart = pragueStartOfMonth(-1)

  const [
    todayAgg,
    yesterdayAgg,
    thisMonthAgg,
    lastMonthAgg,
    pendingCount,
    overdueCount,
    lowStockCount,
    chartOrders,
    recentOrderItems,
    latestOrders,
  ] = await Promise.all([
    // Dnes
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart, lt: tomorrowStart }, status: { notIn: INVALID_STATUSES } },
      _sum: { totalWithVat: true },
      _count: true,
    }),
    // Včera
    prisma.order.aggregate({
      where: { createdAt: { gte: yesterdayStart, lt: todayStart }, status: { notIn: INVALID_STATUSES } },
      _sum: { totalWithVat: true },
      _count: true,
    }),
    // Tento měsíc
    prisma.order.aggregate({
      where: { createdAt: { gte: thisMonthStart }, status: { notIn: INVALID_STATUSES } },
      _sum: { totalWithVat: true },
      _count: true,
    }),
    // Minulý měsíc
    prisma.order.aggregate({
      where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart }, status: { notIn: INVALID_STATUSES } },
      _sum: { totalWithVat: true },
      _count: true,
    }),
    // Čekající objednávky
    prisma.order.count({ where: { status: { in: PENDING_STATUSES } } }),
    // Faktury po splatnosti
    prisma.document.count({
      where: { type: 'INVOICE', status: 'VALID', dueDate: { lt: new Date() } },
    }),
    // Produkty s nízkými zásobami (threshold: 5 ks)
    prisma.product.count({
      where: { trackStock: true, stockQuantity: { lt: 5, gt: 0 } },
    }).catch(() => 0),
    // Data pro graf — posledních 30 dní
    prisma.order.findMany({
      where: {
        createdAt: { gte: pragueStartOfDay(-29) },
        status: { notIn: INVALID_STATUSES },
      },
      select: { createdAt: true, totalWithVat: true },
      orderBy: { createdAt: 'asc' },
    }),
    // TOP produkty — posledních 30 dní
    prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: pragueStartOfDay(-29) },
          status: { notIn: INVALID_STATUSES },
        },
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        lineTotalWithVat: true,
      },
    }),
    // Poslední objednávky
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        contactFirstName: true,
        contactLastName: true,
        companyName: true,
        isBusinessOrder: true,
        totalWithVat: true,
        status: true,
        createdAt: true,
      },
    }),
  ])

  // ── Graf: 30 dní, agreguj per datum ──────────────────────────────
  const chartMap = new Map<string, { revenue: number; orderCount: number }>()
  for (let i = 29; i >= 0; i--) {
    const d = pragueStartOfDay(-i)
    const label = `${d.getDate()}.${d.getMonth() + 1}`
    chartMap.set(label, { revenue: 0, orderCount: 0 })
  }

  for (const order of chartOrders) {
    const d = new Date(order.createdAt)
    const label = `${d.getDate()}.${d.getMonth() + 1}`
    const entry = chartMap.get(label)
    if (entry) {
      entry.revenue += Number(order.totalWithVat)
      entry.orderCount += 1
    }
  }

  const revenueChart = Array.from(chartMap.entries()).map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    orderCount: v.orderCount,
  }))

  // ── TOP 5 produktů ────────────────────────────────────────────────
  const productMap = new Map<
    string,
    { name: string; quantitySold: number; revenue: number }
  >()
  for (const item of recentOrderItems) {
    const key = item.productId ?? item.productName
    const existing = productMap.get(key)
    if (existing) {
      existing.quantitySold += item.quantity
      existing.revenue += Number(item.lineTotalWithVat)
    } else {
      productMap.set(key, {
        name: item.productName,
        quantitySold: item.quantity,
        revenue: Number(item.lineTotalWithVat),
      })
    }
  }

  const topProducts = Array.from(productMap.entries())
    .map(([id, v]) => ({ productId: id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))

  // ── Poslední objednávky ───────────────────────────────────────────
  const latestOrdersMapped = latestOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName:
      o.isBusinessOrder && o.companyName
        ? o.companyName
        : `${o.contactFirstName} ${o.contactLastName}`.trim(),
    totalWithVat: Number(o.totalWithVat),
    status: o.status,
    createdAt: o.createdAt,
  }))

  return {
    today: { orderCount: todayAgg._count, revenue: Number(todayAgg._sum.totalWithVat ?? 0) },
    yesterday: { orderCount: yesterdayAgg._count, revenue: Number(yesterdayAgg._sum.totalWithVat ?? 0) },
    thisMonth: { orderCount: thisMonthAgg._count, revenue: Number(thisMonthAgg._sum.totalWithVat ?? 0) },
    lastMonth: { revenue: Number(lastMonthAgg._sum.totalWithVat ?? 0) },
    needsAttention: {
      pendingOrders: pendingCount,
      overdueInvoices: overdueCount,
      lowStockProducts: lowStockCount,
    },
    revenueChart,
    topProducts,
    latestOrders: latestOrdersMapped,
  }
}
