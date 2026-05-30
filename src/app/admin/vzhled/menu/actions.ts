'use server'

import { revalidatePath } from 'next/cache'
import { MenuLocation, MenuLinkType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

async function authCheck() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')
  return user
}

export type MenuItemFormData = {
  location: MenuLocation
  label: string
  linkType: MenuLinkType
  pageId: string | null
  categoryId: string | null
  url: string | null
  openNewTab: boolean
}

export async function createMenuItem(data: MenuItemFormData) {
  await authCheck()
  if (!data.label.trim()) throw new Error('Název položky je povinný.')
  validateLinkData(data)

  const sortOrder = await prisma.menuItem.count({ where: { location: data.location } })

  await prisma.menuItem.create({
    data: {
      location: data.location,
      label: data.label.trim(),
      linkType: data.linkType,
      pageId: data.linkType === 'PAGE' ? data.pageId : null,
      categoryId: data.linkType === 'CATEGORY' ? data.categoryId : null,
      url: data.linkType === 'URL' ? data.url?.trim() || null : null,
      openNewTab: data.openNewTab,
      sortOrder,
    },
  })

  revalidatePath('/admin/vzhled/menu')
}

export async function updateMenuItem(id: string, data: MenuItemFormData) {
  await authCheck()
  if (!data.label.trim()) throw new Error('Název položky je povinný.')
  validateLinkData(data)

  await prisma.menuItem.update({
    where: { id },
    data: {
      label: data.label.trim(),
      linkType: data.linkType,
      pageId: data.linkType === 'PAGE' ? data.pageId : null,
      categoryId: data.linkType === 'CATEGORY' ? data.categoryId : null,
      url: data.linkType === 'URL' ? data.url?.trim() || null : null,
      openNewTab: data.openNewTab,
    },
  })

  revalidatePath('/admin/vzhled/menu')
}

export async function deleteMenuItem(id: string) {
  await authCheck()
  await prisma.menuItem.delete({ where: { id } })
  revalidatePath('/admin/vzhled/menu')
}

export async function toggleMenuItemVisibility(id: string) {
  await authCheck()
  const item = await prisma.menuItem.findUniqueOrThrow({ where: { id }, select: { isVisible: true } })
  await prisma.menuItem.update({ where: { id }, data: { isVisible: !item.isVisible } })
  revalidatePath('/admin/vzhled/menu')
}

export async function reorderMenuItems(location: MenuLocation, ids: string[]) {
  await authCheck()
  await prisma.$transaction(
    ids.map((id, index) => prisma.menuItem.update({ where: { id }, data: { sortOrder: index } }))
  )
  revalidatePath('/admin/vzhled/menu')
}

function validateLinkData(data: MenuItemFormData) {
  if (data.linkType === 'PAGE' && !data.pageId) throw new Error('Vyberte stránku.')
  if (data.linkType === 'CATEGORY' && !data.categoryId) throw new Error('Vyberte kategorii.')
  if (data.linkType === 'URL' && !data.url?.trim()) throw new Error('Zadejte URL adresu.')
}
