'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { roundMoney } from '@/lib/pricing'

// ── Helpers ───────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uniqueProductSlug(base: string): Promise<string> {
  const baseSlug = slugify(base)
  let slug = baseSlug
  let n = 2
  for (;;) {
    const exists = await prisma.product.findFirst({ where: { slug }, select: { id: true } })
    if (!exists) return slug
    slug = `${baseSlug}-${n++}`
  }
}

async function nextAutoSku(): Promise<string> {
  const rows = await prisma.product.findMany({
    where: { sku: { startsWith: 'AUTO-' } },
    select: { sku: true },
  })
  const max = rows.reduce((m, r) => {
    const n = parseInt(r.sku.replace(/^AUTO-/, '')) || 0
    return Math.max(m, n)
  }, 0)
  return `AUTO-${String(max + 1).padStart(3, '0')}`
}

// ── toggleProductFlag ─────────────────────────────────────────────

type ProductFlag = 'isNew' | 'isFeatured' | 'isOnSale' | 'isActive'

export async function toggleProductFlag(productId: string, flag: ProductFlag) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { isNew: true, isFeatured: true, isOnSale: true, isActive: true },
  })

  await prisma.product.update({
    where: { id: productId },
    data: { [flag]: !product[flag] },
  })

  revalidatePath('/admin/produkty')
}

// ── createProduct ─────────────────────────────────────────────────

export type CreateProductData = {
  name: string
  categoryId: string
  priceWithVat: number
  vatRate: number
}

export async function createProduct(data: CreateProductData): Promise<{ id: string }> {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  if (!data.name.trim()) throw new Error('Název je povinný.')
  if (![0, 12, 21].includes(data.vatRate)) throw new Error('Neplatná sazba DPH.')
  if (data.priceWithVat < 0) throw new Error('Cena musí být nezáporná.')

  const catExists = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  })
  if (!catExists) throw new Error('Vybraná kategorie neexistuje.')

  const [sku, slug] = await Promise.all([
    nextAutoSku(),
    uniqueProductSlug(data.name),
  ])

  const priceWithVat = roundMoney(data.priceWithVat)
  const priceWithoutVat =
    data.vatRate > 0
      ? roundMoney(priceWithVat / (1 + data.vatRate / 100))
      : priceWithVat

  const product = await prisma.product.create({
    data: {
      name: data.name.trim(),
      sku,
      slug,
      priceWithVat,
      priceWithoutVat,
      vatRate: data.vatRate,
      categoryId: data.categoryId,
      stockStatus: 'IN_STOCK',
      stockQuantity: 0,
      trackStock: true,
      unit: 'KS',
      isWeightBased: false,
      isActive: true,
      publishedAt: new Date(),
    },
    select: { id: true },
  })

  revalidatePath('/admin/produkty')
  return { id: product.id }
}

// ── createCategory ────────────────────────────────────────────────

export type CreateCategoryData = {
  name: string
  parentId: string | null
}

export async function createCategory(data: CreateCategoryData): Promise<void> {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')

  if (!data.name.trim()) throw new Error('Název je povinný.')

  if (data.parentId) {
    const parentExists = await prisma.category.findUnique({
      where: { id: data.parentId },
      select: { id: true },
    })
    if (!parentExists) throw new Error('Nadřazená kategorie neexistuje.')
  }

  // Unique slug
  const baseSlug = slugify(data.name)
  let slug = baseSlug
  let n = 2
  for (;;) {
    const exists = await prisma.category.findFirst({ where: { slug }, select: { id: true } })
    if (!exists) break
    slug = `${baseSlug}-${n++}`
  }

  // sortOrder = max sibling + 10
  const siblings = await prisma.category.findMany({
    where: data.parentId ? { parentId: data.parentId } : { parentId: null },
    select: { sortOrder: true },
  })
  const maxOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), 0)

  await prisma.category.create({
    data: {
      name: data.name.trim(),
      slug,
      parentId: data.parentId || null,
      sortOrder: maxOrder + 10,
      isActive: true,
    },
  })

  revalidatePath('/admin/produkty')
}
