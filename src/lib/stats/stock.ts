import { prisma } from '@/lib/prisma'
import { INVALID_STATUSES, pragueStartOfDay } from './helpers'

export type StockStats = {
  lowStock: Array<{ productId: string; name: string; stockQuantity: number; soldLast30: number }>
  deadStock: Array<{ productId: string; name: string; stockQuantity: number; lastOrderDate: Date | null }>
  fastMovers: Array<{ productId: string; name: string; soldLast90: number; stockQuantity: number; turnoverDays: number }>
}

export async function getStockStats(): Promise<StockStats> {
  const thirtyDaysAgo = pragueStartOfDay(-30)
  const ninetyDaysAgo = pragueStartOfDay(-90)

  const [trackedProducts, recentItems90, recentItems30] = await Promise.all([
    prisma.product.findMany({
      where: { trackStock: true, isActive: true },
      select: { id: true, name: true, stockQuantity: true },
    }),
    prisma.orderItem.findMany({
      where: {
        productId: { not: null },
        order: { createdAt: { gte: ninetyDaysAgo }, status: { notIn: INVALID_STATUSES } },
      },
      select: { productId: true, quantity: true, order: { select: { createdAt: true } } },
    }),
    prisma.orderItem.findMany({
      where: {
        productId: { not: null },
        order: { createdAt: { gte: thirtyDaysAgo }, status: { notIn: INVALID_STATUSES } },
      },
      select: { productId: true, quantity: true },
    }),
  ])

  // Map: productId → sold last 30 days
  const sold30Map = new Map<string, number>()
  for (const item of recentItems30) {
    if (!item.productId) continue
    sold30Map.set(item.productId, (sold30Map.get(item.productId) ?? 0) + item.quantity)
  }

  // Map: productId → { sold90, lastDate }
  const sold90Map = new Map<string, { qty: number; lastDate: Date }>()
  for (const item of recentItems90) {
    if (!item.productId) continue
    const e = sold90Map.get(item.productId)
    const d = item.order.createdAt
    if (e) {
      e.qty += item.quantity
      if (d > e.lastDate) e.lastDate = d
    } else {
      sold90Map.set(item.productId, { qty: item.quantity, lastDate: d })
    }
  }

  const lowStock = trackedProducts
    .filter(p => (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) < 5)
    .map(p => ({
      productId: p.id,
      name: p.name,
      stockQuantity: Number(p.stockQuantity ?? 0),
      soldLast30: sold30Map.get(p.id) ?? 0,
    }))
    .sort((a, b) => a.stockQuantity - b.stockQuantity)

  const deadStock = trackedProducts
    .filter(p => (p.stockQuantity ?? 0) > 0 && !sold30Map.has(p.id))
    .map(p => ({
      productId: p.id,
      name: p.name,
      stockQuantity: Number(p.stockQuantity ?? 0),
      lastOrderDate: sold90Map.get(p.id)?.lastDate ?? null,
    }))
    .sort((a, b) => b.stockQuantity - a.stockQuantity)
    .slice(0, 50)

  const fastMovers = trackedProducts
    .filter(p => sold90Map.has(p.id) && (p.stockQuantity ?? 0) > 0)
    .map(p => {
      const sold = sold90Map.get(p.id)!.qty
      const stock = Number(p.stockQuantity ?? 0)
      const dailySales = sold / 90
      const turnoverDays = dailySales > 0 ? Math.round(stock / dailySales) : 999
      return { productId: p.id, name: p.name, soldLast90: sold, stockQuantity: stock, turnoverDays }
    })
    .sort((a, b) => a.turnoverDays - b.turnoverDays)
    .slice(0, 20)

  return { lowStock, deadStock, fastMovers }
}
