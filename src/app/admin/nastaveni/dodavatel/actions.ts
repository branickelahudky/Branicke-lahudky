'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

export type SupplierSettingsData = {
  companyName: string
  street: string
  city: string
  postalCode: string
  country: string
  companyId: string
  vatId: string | null
  isVatPayer: boolean
  bankAccount: string | null
  iban: string | null
  legalNote: string | null
  logoUrl: string | null
  invoiceFooterNote: string | null
  defaultDueDays: number
}

export async function upsertSupplierSettings(data: SupplierSettingsData) {
  const { user } = await requireAuth()
  if (user.role !== 'OWNER') throw new Error('Nastavení dodavatele může měnit pouze majitel.')

  if (!data.companyName.trim()) throw new Error('Název firmy je povinný.')
  if (!data.street.trim()) throw new Error('Ulice je povinná.')
  if (!data.city.trim()) throw new Error('Město je povinné.')
  if (!data.postalCode.trim()) throw new Error('PSČ je povinné.')
  if (!data.companyId.trim()) throw new Error('IČO je povinné.')
  if (!/^\d{8}$/.test(data.companyId.trim())) throw new Error('IČO musí mít přesně 8 číslic.')
  if (data.isVatPayer && !data.vatId?.trim()) throw new Error('DIČ je povinné pro plátce DPH.')
  if (data.defaultDueDays < 1 || data.defaultDueDays > 365)
    throw new Error('Splatnost musí být 1–365 dní.')

  const existing = await prisma.supplierSettings.findFirst({ select: { id: true } })

  const payload = {
    companyName: data.companyName.trim(),
    street: data.street.trim(),
    city: data.city.trim(),
    postalCode: data.postalCode.trim(),
    country: data.country || 'Česká republika',
    companyId: data.companyId.trim(),
    vatId: data.isVatPayer ? (data.vatId?.trim() || null) : null,
    isVatPayer: data.isVatPayer,
    bankAccount: data.bankAccount?.trim() || null,
    iban: data.iban?.trim() || null,
    legalNote: data.legalNote?.trim() || null,
    logoUrl: data.logoUrl?.trim() || null,
    invoiceFooterNote: data.invoiceFooterNote?.trim() || null,
    defaultDueDays: data.defaultDueDays,
  }

  if (existing) {
    await prisma.supplierSettings.update({ where: { id: existing.id }, data: payload })
  } else {
    await prisma.supplierSettings.create({ data: payload })
  }

  revalidatePath('/admin/nastaveni/dodavatel')
}
