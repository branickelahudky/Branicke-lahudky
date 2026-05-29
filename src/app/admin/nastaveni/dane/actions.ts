'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

export type TaxSettingsData = {
  isVatPayer: boolean
  defaultPricesIncludeVat: boolean
  defaultB2BPricesIncludeVat: boolean
  defaultCountry: string
}

export type VatRateUpdateData = {
  rate: number
  isDefault: boolean
  isActive: boolean
}

export type SerializedVatRate = {
  id: string
  code: string
  name: string
  rate: number
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  description: string | null
}

const VAT_SEED = [
  {
    code: 'REDUCED',
    name: 'Snížená sazba',
    rate: 12,
    isDefault: true,
    isActive: true,
    sortOrder: 1,
    description: 'Potraviny, maso, lahůdky, mléko, voda, léky',
  },
  {
    code: 'STANDARD',
    name: 'Základní sazba',
    rate: 21,
    isDefault: false,
    isActive: true,
    sortOrder: 2,
    description: 'Většina nealko nápojů, alkohol, doprava, balné',
  },
  {
    code: 'ZERO',
    name: 'Nulová daň',
    rate: 0,
    isDefault: false,
    isActive: false,
    sortOrder: 3,
    description: 'Knihy',
  },
]

export async function seedAndLoadDaneData(): Promise<{
  taxSettings: TaxSettingsData
  vatRates: SerializedVatRate[]
}> {
  // Seed VatRate if empty
  const rateCount = await prisma.vatRate.count()
  if (rateCount === 0) {
    await prisma.vatRate.createMany({ data: VAT_SEED })
  }

  // Seed TaxSettings if empty
  const taxCount = await prisma.taxSettings.count()
  if (taxCount === 0) {
    await prisma.taxSettings.create({
      data: {
        isVatPayer: true,
        defaultPricesIncludeVat: true,
        defaultB2BPricesIncludeVat: false,
        defaultCountry: 'CZ',
      },
    })
  }

  const [taxSettings, vatRates] = await Promise.all([
    prisma.taxSettings.findFirst(),
    prisma.vatRate.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  return {
    taxSettings: {
      isVatPayer: taxSettings!.isVatPayer,
      defaultPricesIncludeVat: taxSettings!.defaultPricesIncludeVat,
      defaultB2BPricesIncludeVat: taxSettings!.defaultB2BPricesIncludeVat,
      defaultCountry: taxSettings!.defaultCountry,
    },
    vatRates: vatRates.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      rate: Number(r.rate),
      isDefault: r.isDefault,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      description: r.description,
    })),
  }
}

export async function updateTaxSettings(data: TaxSettingsData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nastavení daní může měnit pouze správce nebo majitel.')

  const existing = await prisma.taxSettings.findFirst({ select: { id: true } })

  const payload = {
    isVatPayer: data.isVatPayer,
    defaultPricesIncludeVat: data.defaultPricesIncludeVat,
    defaultB2BPricesIncludeVat: data.defaultB2BPricesIncludeVat,
    defaultCountry: data.defaultCountry || 'CZ',
  }

  if (existing) {
    await prisma.taxSettings.update({ where: { id: existing.id }, data: payload })
  } else {
    await prisma.taxSettings.create({ data: payload })
  }

  revalidatePath('/admin/nastaveni/dane')
}

export async function updateVatRate(id: string, data: VatRateUpdateData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Sazby DPH může měnit pouze správce nebo majitel.')

  if (data.rate < 0 || data.rate > 100) throw new Error('Sazba DPH musí být mezi 0 a 100 %.')

  // Pokud nastavujeme jako výchozí, odebrat default ostatním
  if (data.isDefault) {
    await prisma.vatRate.updateMany({
      where: { id: { not: id } },
      data: { isDefault: false },
    })
  }

  await prisma.vatRate.update({
    where: { id },
    data: {
      rate: data.rate,
      isDefault: data.isDefault,
      isActive: data.isActive,
    },
  })

  revalidatePath('/admin/nastaveni/dane')
}
