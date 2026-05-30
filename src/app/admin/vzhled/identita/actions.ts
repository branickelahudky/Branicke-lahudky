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

async function getOrCreateIdentity() {
  const existing = await prisma.siteIdentity.findFirst()
  if (existing) return existing
  return prisma.siteIdentity.create({ data: {} })
}

export type IdentityFormData = {
  logoAlt: string | null
  socialFacebook: string | null
  socialInstagram: string | null
  socialYoutube: string | null
  socialTiktok: string | null
  footerText: string | null
  footerCopyright: string | null
}

function isValidUrlOrEmpty(val: string | null): boolean {
  if (!val || val.trim() === '') return true
  try {
    new URL(val.trim())
    return true
  } catch {
    return false
  }
}

export async function updateIdentity(data: IdentityFormData) {
  await authCheck()

  for (const [field, val] of [
    ['Facebook', data.socialFacebook],
    ['Instagram', data.socialInstagram],
    ['YouTube', data.socialYoutube],
    ['TikTok', data.socialTiktok],
  ] as [string, string | null][]) {
    if (!isValidUrlOrEmpty(val)) throw new Error(`${field}: zadejte platnou URL (https://...).`)
  }

  const identity = await getOrCreateIdentity()

  await prisma.siteIdentity.update({
    where: { id: identity.id },
    data: {
      logoAlt: data.logoAlt?.trim() || null,
      socialFacebook: data.socialFacebook?.trim() || null,
      socialInstagram: data.socialInstagram?.trim() || null,
      socialYoutube: data.socialYoutube?.trim() || null,
      socialTiktok: data.socialTiktok?.trim() || null,
      footerText: data.footerText?.trim() || null,
      footerCopyright: data.footerCopyright?.trim() || null,
    },
  })

  revalidatePath('/admin/vzhled/identita')
}

export async function deleteIdentityAsset(type: 'logo' | 'favicon') {
  await authCheck()

  const identity = await prisma.siteIdentity.findFirst({
    select: { id: true, logoStorageKey: true, faviconStorageKey: true },
  })
  if (!identity) return

  const key = type === 'logo' ? identity.logoStorageKey : identity.faviconStorageKey
  if (key) await deleteFromR2(key).catch(() => {})

  await prisma.siteIdentity.update({
    where: { id: identity.id },
    data:
      type === 'logo'
        ? { logoUrl: null, logoStorageKey: null }
        : { faviconUrl: null, faviconStorageKey: null },
  })

  revalidatePath('/admin/vzhled/identita')
}
