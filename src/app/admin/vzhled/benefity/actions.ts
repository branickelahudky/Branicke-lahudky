'use server'

// Server actions pro správu benefitů (USP) — stejný vzor jako menu.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { USP_ICONS } from '@/lib/usp-icons'

async function authCheck() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')
  return user
}

export type UspItemFormData = {
  icon: string
  title: string
  subtitle: string | null
}

function validate(data: UspItemFormData) {
  if (!data.title.trim()) throw new Error('Titulek je povinný.')
  if (!USP_ICONS[data.icon]) throw new Error('Neplatná ikona.')
}

function revalidate() {
  revalidatePath('/admin/vzhled/benefity')
  revalidatePath('/') // homepage
  revalidatePath('/pokladna')
}

export async function createUspItem(data: UspItemFormData) {
  await authCheck()
  validate(data)
  const last = await prisma.uspItem.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })
  await prisma.uspItem.create({
    data: {
      icon: data.icon,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  revalidate()
}

export async function updateUspItem(id: string, data: UspItemFormData) {
  await authCheck()
  validate(data)
  await prisma.uspItem.update({
    where: { id },
    data: {
      icon: data.icon,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
    },
  })
  revalidate()
}

export async function deleteUspItem(id: string) {
  await authCheck()
  await prisma.uspItem.delete({ where: { id } })
  revalidate()
}

export async function toggleUspItemActive(id: string) {
  await authCheck()
  const item = await prisma.uspItem.findUnique({ where: { id }, select: { isActive: true } })
  if (!item) throw new Error('Položka nenalezena.')
  await prisma.uspItem.update({ where: { id }, data: { isActive: !item.isActive } })
  revalidate()
}

export async function reorderUspItems(ids: string[]) {
  await authCheck()
  await prisma.$transaction(
    ids.map((id, index) => prisma.uspItem.update({ where: { id }, data: { sortOrder: index } }))
  )
  revalidate()
}
