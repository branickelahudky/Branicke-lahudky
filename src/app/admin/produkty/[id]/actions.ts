'use server'

import { revalidatePath } from 'next/cache'
import { Unit, StockStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { roundMoney } from '@/lib/pricing'

export type UpdateProductData = {
  name: string
  slug: string
  sku: string
  shortDescription: string | null
  description: string | null
  priceWithVat: number
  vatRate: number
  isOnSale: boolean
  salePriceWithVat: number | null
  saleStartsAt: string | null  // 'YYYY-MM-DD'
  saleEndsAt: string | null
  isWeightBased: boolean
  unit: string
  trackStock: boolean
  stockQuantity: number
  stockStatus: string
  categoryId: string
  isNew: boolean
  isFeatured: boolean
  isOnClearance: boolean
  isActive: boolean
}

export async function updateProduct(productId: string, data: UpdateProductData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  if (!data.name.trim()) throw new Error('Název je povinný.')
  if (!data.slug.trim()) throw new Error('URL adresa je povinná.')
  if (!data.sku.trim()) throw new Error('SKU je povinné.')
  if (data.priceWithVat < 0) throw new Error('Cena musí být nezáporná.')
  if (![0, 12, 21].includes(data.vatRate)) throw new Error('Neplatná sazba DPH.')
  if (data.stockQuantity < 0) throw new Error('Množství musí být nezáporné.')

  // Unique checks (exclude self)
  const [existingSku, existingSlug, current] = await Promise.all([
    prisma.product.findFirst({
      where: { sku: data.sku.trim(), id: { not: productId } },
      select: { id: true },
    }),
    prisma.product.findFirst({
      where: { slug: data.slug.trim(), id: { not: productId } },
      select: { id: true },
    }),
    prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { publishedAt: true },
    }),
  ])

  if (existingSku) throw new Error('SKU je již použito jiným produktem.')
  if (existingSlug) throw new Error('URL adresa je již použita jiným produktem.')

  // Compute prices without VAT
  const priceWithoutVat =
    data.vatRate > 0
      ? roundMoney(data.priceWithVat / (1 + data.vatRate / 100))
      : data.priceWithVat

  const salePriceWithoutVat =
    data.isOnSale && data.salePriceWithVat !== null
      ? data.vatRate > 0
        ? roundMoney(data.salePriceWithVat / (1 + data.vatRate / 100))
        : data.salePriceWithVat
      : null

  await prisma.product.update({
    where: { id: productId },
    data: {
      name: data.name.trim(),
      slug: data.slug.trim(),
      sku: data.sku.trim(),
      shortDescription: data.shortDescription?.trim() || null,
      description: data.description?.trim() || null,
      priceWithVat: data.priceWithVat,
      priceWithoutVat,
      vatRate: data.vatRate,
      salePriceWithVat: data.isOnSale ? data.salePriceWithVat : null,
      salePriceWithoutVat: data.isOnSale ? salePriceWithoutVat : null,
      saleStartsAt: data.isOnSale && data.saleStartsAt ? new Date(data.saleStartsAt) : null,
      saleEndsAt: data.isOnSale && data.saleEndsAt ? new Date(data.saleEndsAt) : null,
      isOnSale: data.isOnSale,
      isWeightBased: data.isWeightBased,
      unit: data.unit as Unit,
      trackStock: data.trackStock,
      stockQuantity: data.stockQuantity,
      stockStatus: data.stockStatus as StockStatus,
      categoryId: data.categoryId,
      isNew: data.isNew,
      isFeatured: data.isFeatured,
      isOnClearance: data.isOnClearance,
      isActive: data.isActive,
      publishedAt: data.isActive ? (current.publishedAt ?? new Date()) : null,
    },
  })

  revalidatePath('/admin/produkty')
  revalidatePath(`/admin/produkty/${productId}`)
}

export async function deleteProduct(productId: string) {
  const { user } = await requireAuth()
  if (user.role !== 'OWNER') throw new Error('Smazat produkt může pouze majitel.')

  const orderItemCount = await prisma.orderItem.count({ where: { productId } })

  if (orderItemCount > 0) {
    throw new Error(
      `Nelze smazat produkt – je v ${orderItemCount} objednávkách. Skryjte ho místo toho.`,
    )
  }

  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { productId } }),
    prisma.productVariant.deleteMany({ where: { productId } }),
    prisma.product.delete({ where: { id: productId } }),
  ])

  revalidatePath('/admin/produkty')
}
