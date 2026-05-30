'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

async function authCheck() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění')
}

async function getOrCreate() {
  const existing = await prisma.cookieSettings.findFirst()
  if (existing) return existing
  return prisma.cookieSettings.create({ data: {} })
}

export type CookieFormData = {
  enabled: boolean
  bannerTitle: string
  bannerText: string | null
  acceptAllLabel: string
  rejectLabel: string
  policyPageId: string | null
}

export async function updateCookieSettings(data: CookieFormData) {
  await authCheck()

  if (!data.bannerTitle.trim()) throw new Error('Titulek lišty je povinný.')
  if (!data.acceptAllLabel.trim()) throw new Error('Text tlačítka souhlasu je povinný.')
  if (!data.rejectLabel.trim()) throw new Error('Text tlačítka odmítnutí je povinný.')

  const record = await getOrCreate()

  await prisma.cookieSettings.update({
    where: { id: record.id },
    data: {
      enabled: data.enabled,
      bannerTitle: data.bannerTitle.trim(),
      bannerText: data.bannerText?.trim() || null,
      acceptAllLabel: data.acceptAllLabel.trim(),
      rejectLabel: data.rejectLabel.trim(),
      policyPageId: data.policyPageId || null,
    },
  })

  revalidatePath('/admin/vzhled/cookies')
}
