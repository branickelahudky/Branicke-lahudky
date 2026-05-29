'use server'

import { revalidatePath } from 'next/cache'
import { Unit, StockStatus, StorageTemp, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { roundMoney } from '@/lib/pricing'
import { ALLERGENS } from '@/lib/product-constants'

const VALID_ALLERGEN_CODES = new Set(ALLERGENS.map((a) => a.code))

export async function reorderProductImages(productId: string, imageIds: string[]) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  const existing = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((i) => i.id))
  if (!imageIds.every((id) => existingIds.has(id))) {
    throw new Error('Neplatné ID obrázku.')
  }

  await prisma.$transaction(
    imageIds.map((id, index) =>
      prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
    ),
  )

  revalidatePath(`/admin/produkty/${productId}`)
}

export async function setPrimaryImage(productId: string, imageId: string) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  const image = await prisma.productImage.findUnique({ where: { id: imageId } })
  if (!image || image.productId !== productId) throw new Error('Obrázek nenalezen.')

  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
    prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ])

  revalidatePath(`/admin/produkty/${productId}`)
}

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

export async function updateProductCategory(productId: string, categoryId: string) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!category) throw new Error('Kategorie nenalezena.')

  await prisma.product.update({ where: { id: productId }, data: { categoryId } })
  revalidatePath('/admin/produkty')
  revalidatePath(`/admin/produkty/${productId}`)
}

export type LogisticsData = {
  weightGrams: number | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  storageTemp: string
  shelfLifeDays: number | null
  isFragile: boolean
}

export async function updateProductLogistics(productId: string, data: LogisticsData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  if (data.weightGrams !== null && data.weightGrams < 0) throw new Error('Hmotnost musí být nezáporná.')
  if (data.lengthMm !== null && data.lengthMm < 0) throw new Error('Délka musí být nezáporná.')
  if (data.widthMm !== null && data.widthMm < 0) throw new Error('Šířka musí být nezáporná.')
  if (data.heightMm !== null && data.heightMm < 0) throw new Error('Výška musí být nezáporná.')
  if (data.shelfLifeDays !== null && data.shelfLifeDays < 0) throw new Error('Trvanlivost musí být nezáporná.')
  if (!Object.values(StorageTemp).includes(data.storageTemp as StorageTemp)) {
    throw new Error('Neplatná skladovací teplota.')
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      weightGrams: data.weightGrams,
      lengthMm: data.lengthMm,
      widthMm: data.widthMm,
      heightMm: data.heightMm,
      storageTemp: data.storageTemp as StorageTemp,
      shelfLifeDays: data.shelfLifeDays,
      isFragile: data.isFragile,
    },
  })

  revalidatePath(`/admin/produkty/${productId}`)
}

export type ParametersData = {
  nutritionPer100g: {
    energyKj: string
    energyKcal: string
    fat: string
    saturatedFat: string
    carbohydrates: string
    sugars: string
    protein: string
    salt: string
    fiber: string
  } | null
  allergenCodes: string[]
  allergenInfo: string | null
  ingredients: string | null
  countryOfOrigin: string | null
  producerName: string | null
  producerAddress: string | null
  useByInstructions: string | null
  storageInstructions: string | null
}

export async function updateProductParameters(productId: string, data: ParametersData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  if (!Array.isArray(data.allergenCodes)) throw new Error('Alergeny musí být pole.')
  for (const code of data.allergenCodes) {
    if (!VALID_ALLERGEN_CODES.has(code)) throw new Error(`Neplatný kód alergenu: ${code}`)
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      nutritionPer100g: data.nutritionPer100g ?? undefined,
      allergenCodes: data.allergenCodes.length > 0 ? data.allergenCodes : Prisma.DbNull,
      allergenInfo: data.allergenInfo?.trim() || null,
      ingredients: data.ingredients?.trim() || null,
      countryOfOrigin: data.countryOfOrigin?.trim() || null,
      producerName: data.producerName?.trim() || null,
      producerAddress: data.producerAddress?.trim() || null,
      useByInstructions: data.useByInstructions?.trim() || null,
      storageInstructions: data.storageInstructions?.trim() || null,
    },
  })

  revalidatePath(`/admin/produkty/${productId}`)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createCategory(name: string, parentId: string | null) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  if (!name.trim()) throw new Error('Název kategorie je povinný.')

  let slug = slugify(name)
  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } })
  if (existing) slug = `${slug}-${Date.now()}`

  const category = await prisma.category.create({
    data: { name: name.trim(), slug, parentId: parentId || null },
  })

  revalidatePath('/admin/produkty')
  return category
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
