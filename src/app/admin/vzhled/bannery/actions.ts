'use server'

import { revalidatePath } from 'next/cache'
import { BannerLinkType, BannerPlacement } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { deleteFromR2 } from '@/lib/image-upload'

async function authCheck() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')
}

export type BannerFormData = {
  imageUrl: string
  imageStorageKey: string
  imageAlt: string | null
  placement: BannerPlacement
  title: string | null
  subtitle: string | null
  linkType: BannerLinkType
  pageId: string | null
  categoryId: string | null
  url: string | null
  openNewTab: boolean
}

export async function createBanner(data: BannerFormData) {
  await authCheck()
  if (!data.imageUrl) throw new Error('Obrázek banneru je povinný.')
  validateLink(data)

  // Řazení v rámci stejného umístění (nový banner se přidá na konec své pozice)
  const sortOrder = await prisma.banner.count({ where: { placement: data.placement } })

  await prisma.banner.create({
    data: {
      imageUrl: data.imageUrl,
      imageStorageKey: data.imageStorageKey,
      imageAlt: data.imageAlt?.trim() || null,
      placement: data.placement,
      title: data.title?.trim() || null,
      subtitle: data.subtitle?.trim() || null,
      linkType: data.linkType,
      pageId: data.linkType === 'PAGE' ? data.pageId : null,
      categoryId: data.linkType === 'CATEGORY' ? data.categoryId : null,
      url: data.linkType === 'URL' ? data.url?.trim() || null : null,
      openNewTab: data.openNewTab,
      sortOrder,
    },
  })

  revalidatePath('/admin/vzhled/bannery')
  revalidatePath('/')
}

export async function updateBanner(id: string, data: Omit<BannerFormData, 'imageUrl' | 'imageStorageKey'> & {
  imageUrl?: string
  imageStorageKey?: string
}) {
  await authCheck()
  validateLink(data as BannerFormData)

  const existing = await prisma.banner.findUniqueOrThrow({ where: { id }, select: { imageStorageKey: true } })

  // Replace image if new one provided
  if (data.imageUrl && data.imageStorageKey && data.imageStorageKey !== existing.imageStorageKey) {
    await deleteFromR2(existing.imageStorageKey).catch(() => {})
  }

  await prisma.banner.update({
    where: { id },
    data: {
      ...(data.imageUrl && { imageUrl: data.imageUrl, imageStorageKey: data.imageStorageKey }),
      imageAlt: data.imageAlt?.trim() || null,
      placement: data.placement,
      title: data.title?.trim() || null,
      subtitle: data.subtitle?.trim() || null,
      linkType: data.linkType,
      pageId: data.linkType === 'PAGE' ? data.pageId : null,
      categoryId: data.linkType === 'CATEGORY' ? data.categoryId : null,
      url: data.linkType === 'URL' ? data.url?.trim() || null : null,
      openNewTab: data.openNewTab,
    },
  })

  revalidatePath('/admin/vzhled/bannery')
  revalidatePath('/')
}

export async function deleteBanner(id: string) {
  await authCheck()

  const banner = await prisma.banner.findUniqueOrThrow({
    where: { id },
    select: { imageStorageKey: true },
  })

  await deleteFromR2(banner.imageStorageKey).catch(() => {})
  await prisma.banner.delete({ where: { id } })
  revalidatePath('/admin/vzhled/bannery')
  revalidatePath('/')
}

export async function toggleBannerVisibility(id: string) {
  await authCheck()
  const b = await prisma.banner.findUniqueOrThrow({ where: { id }, select: { isVisible: true } })
  await prisma.banner.update({ where: { id }, data: { isVisible: !b.isVisible } })
  revalidatePath('/admin/vzhled/bannery')
  revalidatePath('/')
}

export async function reorderBanners(ids: string[]) {
  await authCheck()
  await prisma.$transaction(
    ids.map((id, index) => prisma.banner.update({ where: { id }, data: { sortOrder: index } }))
  )
  revalidatePath('/admin/vzhled/bannery')
  revalidatePath('/')
}

function validateLink(data: Pick<BannerFormData, 'linkType' | 'pageId' | 'categoryId' | 'url'>) {
  if (data.linkType === 'PAGE' && !data.pageId) throw new Error('Vyberte stránku.')
  if (data.linkType === 'CATEGORY' && !data.categoryId) throw new Error('Vyberte kategorii.')
  if (data.linkType === 'URL' && !data.url?.trim()) throw new Error('Zadejte URL adresu.')
}
