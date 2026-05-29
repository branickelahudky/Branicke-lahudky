'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { roundMoney, priceWithoutVat } from '@/lib/pricing'

const PATH = '/admin/nastaveni/doprava'

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
}

async function assertAdminOrOwner() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')
  return user
}

export async function createShippingMethod(data: ShippingMethodData) {
  await assertAdminOrOwner()
  if (!data.name.trim()) throw new Error('Název je povinný.')

  const priceVat = roundMoney(data.priceWithVat)
  const priceNoVat = roundMoney(priceWithoutVat(priceVat, data.vatRate))
  const code = `SM_${Date.now()}`

  await prisma.shippingMethod.create({
    data: {
      code,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      priceWithVat: priceVat,
      priceWithoutVat: priceNoVat,
      vatRate: data.vatRate,
      isPickup: data.isPickup,
      estimatedDays: data.estimatedDays?.trim() || null,
      freeShippingThreshold: data.freeShippingThreshold ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  })
  revalidatePath(PATH)
}

export async function updateShippingMethod(id: string, data: ShippingMethodData) {
  await assertAdminOrOwner()
  if (!data.name.trim()) throw new Error('Název je povinný.')

  const priceVat = roundMoney(data.priceWithVat)
  const priceNoVat = roundMoney(priceWithoutVat(priceVat, data.vatRate))

  await prisma.shippingMethod.update({
    where: { id },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      priceWithVat: priceVat,
      priceWithoutVat: priceNoVat,
      vatRate: data.vatRate,
      isPickup: data.isPickup,
      estimatedDays: data.estimatedDays?.trim() || null,
      freeShippingThreshold: data.freeShippingThreshold ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  })
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
