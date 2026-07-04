'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { roundMoney, priceWithoutVat } from '@/lib/pricing'

const PATH = '/admin/nastaveni/doprava'

export type WeightTierData = {
  maxWeightKg: number
  priceWithVat: number
}

export type ShippingMethodData = {
  name: string
  description: string | null
  priceWithVat: number
  vatRate: number
  isPickup: boolean
  estimatedDays: string | null
  freeShippingThreshold: number | null
  sortOrder: number
  isActive: boolean
  // Ceník podle váhy (Cool Balík)
  usesWeightTiers: boolean
  weightTiers: WeightTierData[]
  fuelSurchargePercent: number
  defaultItemWeightGrams: number
  maxWeightKg: number | null
  /** Země doručení: 'CZ' / 'SK' */
  countries: string[]
}

function validateTiers(data: ShippingMethodData): WeightTierData[] {
  if (!data.usesWeightTiers) return []
  const tiers = data.weightTiers
    .filter((t) => t.maxWeightKg > 0 && t.priceWithVat >= 0)
    .sort((a, b) => a.maxWeightKg - b.maxWeightKg)
  if (tiers.length === 0) {
    throw new Error('Ceník podle váhy potřebuje alespoň jedno pásmo (do kg / cena).')
  }
  return tiers
}

async function assertAdminOrOwner() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')
  return user
}

function methodData(data: ShippingMethodData) {
  const priceVat = roundMoney(data.priceWithVat)
  return {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    priceWithVat: priceVat,
    priceWithoutVat: roundMoney(priceWithoutVat(priceVat, data.vatRate)),
    vatRate: data.vatRate,
    isPickup: data.isPickup,
    estimatedDays: data.estimatedDays?.trim() || null,
    freeShippingThreshold: data.freeShippingThreshold ?? null,
    sortOrder: data.sortOrder,
    isActive: data.isActive,
    usesWeightTiers: data.usesWeightTiers,
    fuelSurchargePercent: roundMoney(Math.max(0, data.fuelSurchargePercent)),
    defaultItemWeightGrams: Math.max(1, Math.round(data.defaultItemWeightGrams) || 1000),
    maxWeightKg: data.maxWeightKg ?? null,
    availableCountries: data.countries.length ? data.countries : ['CZ'],
  }
}

export async function createShippingMethod(data: ShippingMethodData) {
  await assertAdminOrOwner()
  if (!data.name.trim()) throw new Error('Název je povinný.')
  const tiers = validateTiers(data)
  const code = `SM_${Date.now()}`

  await prisma.shippingMethod.create({
    data: {
      code,
      ...methodData(data),
      weightTiers: {
        create: tiers.map((t, i) => ({
          maxWeightKg: t.maxWeightKg,
          priceWithVat: roundMoney(t.priceWithVat),
          sortOrder: i,
        })),
      },
    },
  })
  revalidatePath(PATH)
}

export async function updateShippingMethod(id: string, data: ShippingMethodData) {
  await assertAdminOrOwner()
  if (!data.name.trim()) throw new Error('Název je povinný.')
  const tiers = validateTiers(data)

  await prisma.$transaction([
    prisma.shippingMethod.update({ where: { id }, data: methodData(data) }),
    prisma.shippingWeightTier.deleteMany({ where: { shippingMethodId: id } }),
    ...(tiers.length
      ? [
          prisma.shippingWeightTier.createMany({
            data: tiers.map((t, i) => ({
              shippingMethodId: id,
              maxWeightKg: t.maxWeightKg,
              priceWithVat: roundMoney(t.priceWithVat),
              sortOrder: i,
            })),
          }),
        ]
      : []),
  ])
  revalidatePath(PATH)
}

export async function toggleShippingMethod(id: string, isActive: boolean) {
  await assertAdminOrOwner()
  await prisma.shippingMethod.update({ where: { id }, data: { isActive } })
  revalidatePath(PATH)
}

export async function deleteShippingMethod(id: string) {
  await assertAdminOrOwner()

  const orderCount = await prisma.order.count({ where: { shippingMethodId: id } })
  if (orderCount > 0)
    throw new Error(`Nelze smazat – způsob dopravy je použit v ${orderCount} objednávkách.`)

  await prisma.shippingMethod.delete({ where: { id } })
  revalidatePath(PATH)
}
