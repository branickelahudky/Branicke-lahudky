'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

export type BranchSettingsData = {
  name: string
  street: string
  zip: string
  city: string
  country: string
  email: string | null
  phone1: string | null
  phone2: string | null
  managerName: string | null
  openingHours: string | null
}

export async function updateBranchSettings(data: BranchSettingsData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nastavení provozovny může měnit pouze správce nebo majitel.')

  if (!data.name.trim()) throw new Error('Název provozovny je povinný.')
  if (!data.street.trim()) throw new Error('Ulice je povinná.')
  if (!data.zip.trim()) throw new Error('PSČ je povinné.')
  if (!data.city.trim()) throw new Error('Město je povinné.')

  const payload = {
    name: data.name.trim(),
    street: data.street.trim(),
    zip: data.zip.trim(),
    city: data.city.trim(),
    country: data.country || 'Česká republika',
    email: data.email?.trim() || null,
    phone1: data.phone1?.trim() || null,
    phone2: data.phone2?.trim() || null,
    managerName: data.managerName?.trim() || null,
    openingHours: data.openingHours?.trim() || null,
  }

  const existing = await prisma.branchSettings.findFirst({ select: { id: true } })

  if (existing) {
    await prisma.branchSettings.update({ where: { id: existing.id }, data: payload })
  } else {
    await prisma.branchSettings.create({ data: payload })
  }

  revalidatePath('/admin/nastaveni/provozovna')
}
