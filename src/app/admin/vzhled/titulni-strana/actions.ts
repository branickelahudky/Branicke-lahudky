'use server'

import { revalidatePath } from 'next/cache'
import { HomepageSectionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

async function authCheck() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')
}

export async function toggleSectionVisibility(id: string) {
  await authCheck()
  const s = await prisma.homepageSection.findUniqueOrThrow({ where: { id }, select: { isVisible: true } })
  await prisma.homepageSection.update({ where: { id }, data: { isVisible: !s.isVisible } })
  revalidatePath('/admin/vzhled/titulni-strana')
}

export async function reorderSections(ids: string[]) {
  await authCheck()
  await prisma.$transaction(
    ids.map((id, i) => prisma.homepageSection.update({ where: { id }, data: { sortOrder: i } }))
  )
  revalidatePath('/admin/vzhled/titulni-strana')
}

// CAROUSEL — žádná konfigurace, jen title
export async function saveCarouselSection(id: string, title: string | null) {
  await authCheck()
  await prisma.homepageSection.update({ where: { id }, data: { title: title?.trim() || null } })
  revalidatePath('/admin/vzhled/titulni-strana')
}

// FEATURED_CATEGORIES
export async function saveFeaturedCategories(id: string, categoryIds: string[], title: string | null) {
  await authCheck()
  if (categoryIds.length > 8) throw new Error('Maximálně 8 kategorií.')

  await prisma.homepageSection.update({
    where: { id },
    data: { title: title?.trim() || null, config: { categoryIds } },
  })
  revalidatePath('/admin/vzhled/titulni-strana')
}

// FEATURED_PRODUCTS
export type FeaturedProductsMode = 'featured' | 'manual'

export async function saveFeaturedProducts(
  id: string,
  mode: FeaturedProductsMode,
  productIds: string[],
  limit: number,
  title: string | null,
) {
  await authCheck()
  if (limit < 1 || limit > 24) throw new Error('Limit musí být 1–24.')

  await prisma.homepageSection.update({
    where: { id },
    data: {
      title: title?.trim() || null,
      config: { mode, productIds: mode === 'manual' ? productIds : [], limit },
    },
  })
  revalidatePath('/admin/vzhled/titulni-strana')
}

// ABOUT_TEXT
export async function saveAboutText(id: string, text: string, title: string | null) {
  await authCheck()
  await prisma.homepageSection.update({
    where: { id },
    data: { title: title?.trim() || null, config: { text: text.trim() } },
  })
  revalidatePath('/admin/vzhled/titulni-strana')
}

// Live search produktů pro ruční výběr
export async function searchProductsForHomepage(query: string, excludeIds: string[]) {
  await requireAuth()
  if (query.trim().length < 2) return []

  const results = await prisma.product.findMany({
    where: {
      AND: [
        { id: { notIn: excludeIds } },
        { isActive: true },
        { OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
        ]},
      ],
    },
    select: {
      id: true, name: true, sku: true, priceWithVat: true, isFeatured: true,
      images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true }, take: 1 },
    },
    take: 10,
    orderBy: { name: 'asc' },
  })

  return results.map((p) => ({
    id: p.id, name: p.name, sku: p.sku,
    priceWithVat: Number(p.priceWithVat),
    isFeatured: p.isFeatured,
    thumbnailUrl: p.images[0]?.thumbnailUrl || p.images[0]?.url || null,
  }))
}
