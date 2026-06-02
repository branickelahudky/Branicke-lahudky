import { prisma } from '@/lib/prisma'
import type { ProductCardData } from '../_components/ProductCard'

export type NutritionData = {
  energyKj?: number | null
  energyKcal?: number | null
  fat?: number | null
  saturatedFat?: number | null
  carbohydrates?: number | null
  sugars?: number | null
  protein?: number | null
  salt?: number | null
  fiber?: number | null
}

export type ProductDetail = {
  id: string
  slug: string
  sku: string
  name: string
  shortDescription: string | null
  description: string | null
  priceWithVat: number
  priceWithoutVat: number
  vatRate: number
  salePriceWithVat: number | null
  salePriceWithoutVat: number | null
  isWeightBased: boolean
  unit: string
  approximateWeightKg: number | null
  weightGrams: number | null
  stockStatus: string
  stockQuantity: number
  trackStock: boolean
  isOnSale: boolean
  isNew: boolean
  isFeatured: boolean
  images: Array<{
    url: string
    thumbnailUrl: string
    fileSize: number
    altText: string | null
    isPrimary: boolean
  }>
  category: {
    name: string
    slug: string
    parent: { name: string; slug: string } | null
  }
  variants: Array<{
    id: string
    name: string
    priceWithVat: number
    priceWithoutVat: number
    stockQuantity: number
    sortOrder: number
  }>
  ingredients: string | null
  allergenInfo: string | null
  allergenCodes: string[] | null
  countryOfOrigin: string | null
  producerName: string | null
  storageInstructions: string | null
  useByInstructions: string | null
  storageTemp: string
  nutritionPer100g: NutritionData | null
  relatedProducts: ProductCardData[]
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const raw = await prisma.product.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true, slug: true, sku: true, name: true,
      shortDescription: true, description: true,
      priceWithVat: true, priceWithoutVat: true, vatRate: true,
      salePriceWithVat: true, salePriceWithoutVat: true,
      isWeightBased: true, unit: true, approximateWeightKg: true, weightGrams: true,
      stockStatus: true, stockQuantity: true, trackStock: true,
      isOnSale: true, isNew: true, isFeatured: true,
      ingredients: true, allergenInfo: true, allergenCodes: true,
      countryOfOrigin: true, producerName: true,
      storageInstructions: true, useByInstructions: true, storageTemp: true,
      nutritionPer100g: true,
      category: {
        select: {
          name: true, slug: true,
          parent: { select: { name: true, slug: true } },
        },
      },
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { url: true, thumbnailUrl: true, fileSize: true, altText: true, isPrimary: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, name: true,
          priceWithVat: true, priceWithoutVat: true,
          stockQuantity: true, sortOrder: true,
        },
      },
      relatedTo: {
        take: 8,
        select: {
          related: {
            select: {
              id: true, slug: true, sku: true, name: true,
              priceWithVat: true, priceWithoutVat: true, vatRate: true,
              salePriceWithVat: true,
              isWeightBased: true, unit: true, weightGrams: true,
              isOnSale: true, isNew: true, isFeatured: true,
              stockStatus: true, stockQuantity: true, trackStock: true,
              images: {
                where: { isPrimary: true },
                select: { thumbnailUrl: true, url: true, fileSize: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  if (!raw) return null

  const relatedProducts: ProductCardData[] = raw.relatedTo.map(({ related: r }) => ({
    id: r.id, slug: r.slug, sku: r.sku, name: r.name,
    priceWithVat: Number(r.priceWithVat),
    priceWithoutVat: Number(r.priceWithoutVat),
    vatRate: Number(r.vatRate),
    salePriceWithVat: r.salePriceWithVat ? Number(r.salePriceWithVat) : null,
    isWeightBased: r.isWeightBased,
    unit: r.unit,
    weightGrams: r.weightGrams,
    isOnSale: r.isOnSale, isNew: r.isNew, isFeatured: r.isFeatured,
    stockStatus: r.stockStatus, stockQuantity: r.stockQuantity, trackStock: r.trackStock,
    thumbnailUrl: (() => {
      const img = r.images[0]
      if (!img) return null
      const base = img.thumbnailUrl || img.url
      return img.fileSize > 0 ? `${base}?v=${img.fileSize}` : base
    })(),
  }))

  return {
    id: raw.id, slug: raw.slug, sku: raw.sku, name: raw.name,
    shortDescription: raw.shortDescription,
    description: raw.description,
    priceWithVat: Number(raw.priceWithVat),
    priceWithoutVat: Number(raw.priceWithoutVat),
    vatRate: Number(raw.vatRate),
    salePriceWithVat: raw.salePriceWithVat ? Number(raw.salePriceWithVat) : null,
    salePriceWithoutVat: raw.salePriceWithoutVat ? Number(raw.salePriceWithoutVat) : null,
    isWeightBased: raw.isWeightBased,
    unit: raw.unit,
    approximateWeightKg: raw.approximateWeightKg ? Number(raw.approximateWeightKg) : null,
    weightGrams: raw.weightGrams,
    stockStatus: raw.stockStatus,
    stockQuantity: raw.stockQuantity,
    trackStock: raw.trackStock,
    isOnSale: raw.isOnSale, isNew: raw.isNew, isFeatured: raw.isFeatured,
    images: raw.images.map(img => ({
      url: img.fileSize > 0 ? `${img.url}?v=${img.fileSize}` : img.url,
      thumbnailUrl: img.fileSize > 0 ? `${img.thumbnailUrl}?v=${img.fileSize}` : img.thumbnailUrl,
      fileSize: img.fileSize,
      altText: img.altText,
      isPrimary: img.isPrimary,
    })),
    category: raw.category,
    variants: raw.variants.map(v => ({
      id: v.id, name: v.name,
      priceWithVat: Number(v.priceWithVat),
      priceWithoutVat: Number(v.priceWithoutVat),
      stockQuantity: v.stockQuantity,
      sortOrder: v.sortOrder,
    })),
    ingredients: raw.ingredients,
    allergenInfo: raw.allergenInfo,
    allergenCodes: raw.allergenCodes as string[] | null,
    countryOfOrigin: raw.countryOfOrigin,
    producerName: raw.producerName,
    storageInstructions: raw.storageInstructions,
    useByInstructions: raw.useByInstructions,
    storageTemp: raw.storageTemp,
    nutritionPer100g: raw.nutritionPer100g as NutritionData | null,
    relatedProducts,
  }
}
