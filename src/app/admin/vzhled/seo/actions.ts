'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { deleteFromR2 } from '@/lib/image-upload'

async function authCheck() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')
  return user
}

async function getOrCreateSeoSettings() {
  const existing = await prisma.seoSettings.findFirst()
  if (existing) return existing
  return prisma.seoSettings.create({ data: {} })
}

export type SeoFormData = {
  siteTitle: string
  titleTemplate: string
  metaDescription: string | null
}

export async function updateSeoSettings(data: SeoFormData) {
  await authCheck()

  const siteTitle = data.siteTitle.trim()
  const titleTemplate = data.titleTemplate.trim()
  if (!siteTitle) throw new Error('Název webu nesmí být prázdný.')
  if (titleTemplate && !titleTemplate.includes('%s')) {
    throw new Error('Šablona titulku musí obsahovat %s (nahradí se názvem stránky).')
  }

  const settings = await getOrCreateSeoSettings()

  await prisma.seoSettings.update({
    where: { id: settings.id },
    data: {
      siteTitle,
      titleTemplate: titleTemplate || '%s | Branické lahůdkářství',
      metaDescription: data.metaDescription?.trim() || null,
    },
  })

  revalidatePath('/admin/vzhled/seo')
  revalidatePath('/', 'layout')
}

export async function deleteSeoOgImage() {
  await authCheck()

  const settings = await prisma.seoSettings.findFirst({
    select: { id: true, ogImageStorageKey: true },
  })
  if (!settings) return

  if (settings.ogImageStorageKey) await deleteFromR2(settings.ogImageStorageKey).catch(() => {})

  await prisma.seoSettings.update({
    where: { id: settings.id },
    data: { ogImageUrl: null, ogImageStorageKey: null },
  })

  revalidatePath('/admin/vzhled/seo')
  revalidatePath('/', 'layout')
}
