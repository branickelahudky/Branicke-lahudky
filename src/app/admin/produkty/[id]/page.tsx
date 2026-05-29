import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  ProductDetailClient,
  type SerializedProductDetail,
  type SerializedCategoryForModal,
  type SerializedProductImage,
} from './ProductDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: Props) {
  const { user } = await requireAuth()
  const { id } = await params

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            parent: { select: { id: true, name: true } },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      include: {
        children: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, slug: true },
        },
      },
    }),
  ])

  if (!product) notFound()

  const categoryPath = product.category.parent
    ? `${product.category.parent.name} › ${product.category.name}`
    : product.category.name

  const serializedProduct: SerializedProductDetail = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? null,
    description: product.description ?? null,
    priceWithVat: Number(product.priceWithVat),
    priceWithoutVat: Number(product.priceWithoutVat),
    vatRate: Number(product.vatRate),
    salePriceWithVat: product.salePriceWithVat ? Number(product.salePriceWithVat) : null,
    salePriceWithoutVat: product.salePriceWithoutVat
      ? Number(product.salePriceWithoutVat)
      : null,
    saleStartsAt: product.saleStartsAt
      ? product.saleStartsAt.toISOString().slice(0, 10)
      : null,
    saleEndsAt: product.saleEndsAt ? product.saleEndsAt.toISOString().slice(0, 10) : null,
    isWeightBased: product.isWeightBased,
    unit: product.unit,
    stockQuantity: product.stockQuantity,
    stockStatus: product.stockStatus,
    trackStock: product.trackStock,
    categoryId: product.categoryId,
    categoryPath,
    isNew: product.isNew,
    isFeatured: product.isFeatured,
    isOnSale: product.isOnSale,
    isOnClearance: product.isOnClearance,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    // Logistika
    weightGrams: product.weightGrams ?? null,
    lengthMm: product.lengthMm ?? null,
    widthMm: product.widthMm ?? null,
    heightMm: product.heightMm ?? null,
    storageTemp: product.storageTemp,
    shelfLifeDays: product.shelfLifeDays ?? null,
    isFragile: product.isFragile,
    // Parametry
    nutritionPer100g: product.nutritionPer100g ?? null,
    allergenCodes: product.allergenCodes ?? null,
    allergenInfo: product.allergenInfo ?? null,
    ingredients: product.ingredients ?? null,
    countryOfOrigin: product.countryOfOrigin ?? null,
    producerName: product.producerName ?? null,
    producerAddress: product.producerAddress ?? null,
    useByInstructions: product.useByInstructions ?? null,
    storageInstructions: product.storageInstructions ?? null,
  }

  const serializedCategories: SerializedCategoryForModal[] = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    children: cat.children,
  }))

  const serializedImages: SerializedProductImage[] = product.images.map((img) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl,
    storageKey: img.storageKey,
    altText: img.altText,
    sortOrder: img.sortOrder,
    isPrimary: img.isPrimary,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/produkty" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title={`Produkt: ${product.name}`} user={user} />
        <ProductDetailClient
          product={serializedProduct}
          categories={serializedCategories}
          images={serializedImages}
        />
      </div>
    </div>
  )
}
