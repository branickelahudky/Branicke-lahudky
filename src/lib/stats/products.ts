import { prisma } from '@/lib/prisma'
import { INVALID_STATUSES, pragueCurrentYear, pragueStartOfYear, pragueStartOfDay } from './helpers'

export type ProductsStats = {
  bestSellersByQuantity: Array<{ productId: string | null; name: string; quantitySold: number; revenue: number }>
  bestSellersByRevenue: Array<{ productId: string | null; name: string; quantitySold: number; revenue: number }>
  worstSellers: Array<{ productId: string; name: string; stockQuantity: number }>
  categoryRevenue: Array<{ categoryId: string; categoryName: string; revenue: number }>
}

export async function getProductsStats(): Promise<ProductsStats> {
  const year = pragueCurrentYear()
  const yearStart = pragueStartOfYear(year)
  const yearEnd = pragueStartOfYear(year + 1)
  const ninetyDaysAgo = pragueStartOfDay(-90)

  const [yearItems, recentItems, products, categories] = await Promise.all([
    // Items from this year
    prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: yearStart, lt: yearEnd }, status: { notIn: INVALID_STATUSES } },
      },
      select: { productId: true, productName: true, quantity: true, lineTotalWithVat: true },
    }),
    // Items from last 90 days (for worst sellers check)
    prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: ninetyDaysAgo }, status: { notIn: INVALID_STATUSES } },
      },
      select: { productId: true },
    }),
    // All active products with stock
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stockQuantity: true, trackStock: true, categoryId: true },
    }),
    // Categories for revenue breakdown
    prisma.category.findMany({ select: { id: true, name: true } }),
  ])

  // Products sold in last 90 days
  const soldProductIds = new Set(recentItems.map(i => i.productId).filter(Boolean))

  // Aggregate year items by product
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const item of yearItems) {
    const key = item.productId ?? `__${item.productName}`
    const e = productMap.get(key)
    if (e) {
      e.quantity += item.quantity
      e.revenue += Number(item.lineTotalWithVat)
    } else {
      productMap.set(key, { name: item.productName, quantity: item.quantity, revenue: Number(item.lineTotalWithVat) })
    }
  }

  const allProducts = Array.from(productMap.entries()).map(([id, v]) => ({
    productId: id.startsWith('__') ? null : id,
    name: v.name,
    quantitySold: v.quantity,
    revenue: Math.round(v.revenue * 100) / 100,
  }))

  const bestSellersByQuantity = [...allProducts].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 20)
  const bestSellersByRevenue = [...allProducts].sort((a, b) => b.revenue - a.revenue).slice(0, 20)

  // Worst sellers: active products with stock not sold in 90 days
  const worstSellers = products
    .filter(p => p.trackStock && (p.stockQuantity ?? 0) > 0 && !soldProductIds.has(p.id))
    .map(p => ({ productId: p.id, name: p.name, stockQuantity: Number(p.stockQuantity ?? 0) }))
    .slice(0, 20)

  // Category revenue: match orderItems to product categories
  const productCategoryMap = new Map<string, string>()
  for (const p of products) {
    if (p.categoryId) productCategoryMap.set(p.id, p.categoryId)
  }
  const categoryNameMap = new Map(categories.map(c => [c.id, c.name]))
  const catRevenueMap = new Map<string, number>()
  for (const item of yearItems) {
    if (!item.productId) continue
    const catId = productCategoryMap.get(item.productId)
    if (catId) catRevenueMap.set(catId, (catRevenueMap.get(catId) ?? 0) + Number(item.lineTotalWithVat))
  }
  const categoryRevenue = Array.from(catRevenueMap.entries())
    .map(([id, revenue]) => ({ categoryId: id, categoryName: categoryNameMap.get(id) ?? id, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return { bestSellersByQuantity, bestSellersByRevenue, worstSellers, categoryRevenue }
}
