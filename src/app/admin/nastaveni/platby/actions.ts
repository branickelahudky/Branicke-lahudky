'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { roundMoney, priceWithoutVat } from '@/lib/pricing'

const PATH = '/admin/nastaveni/platby'

export type PaymentMethodData = {
  name: string
  description: string | null
  feeWithVat: number
  vatRate: number
  type: string | null
  sortOrder: number
  isActive: boolean
}

async function assertAdminOrOwner() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')
  return user
}

export async function createPaymentMethod(data: PaymentMethodData) {
  await assertAdminOrOwner()
  if (!data.name.trim()) throw new Error('Název je povinný.')

  const feeVat = roundMoney(data.feeWithVat)
  const feeNoVat = roundMoney(priceWithoutVat(feeVat, data.vatRate))
  const code = `PM_${Date.now()}`

  await prisma.paymentMethod.create({
    data: {
      code,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      feeWithVat: feeVat,
      feeWithoutVat: feeNoVat,
      vatRate: data.vatRate,
      type: data.type,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  })
  revalidatePath(PATH)
}

export async function updatePaymentMethod(id: string, data: PaymentMethodData) {
  await assertAdminOrOwner()
  if (!data.name.trim()) throw new Error('Název je povinný.')

  const feeVat = roundMoney(data.feeWithVat)
  const feeNoVat = roundMoney(priceWithoutVat(feeVat, data.vatRate))

  await prisma.paymentMethod.update({
    where: { id },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      feeWithVat: feeVat,
      feeWithoutVat: feeNoVat,
      vatRate: data.vatRate,
      type: data.type,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  })
  revalidatePath(PATH)
}

export async function togglePaymentMethod(id: string, isActive: boolean) {
  await assertAdminOrOwner()
  await prisma.paymentMethod.update({ where: { id }, data: { isActive } })
  revalidatePath(PATH)
}

export async function deletePaymentMethod(id: string) {
  await assertAdminOrOwner()

  const orderCount = await prisma.order.count({ where: { paymentMethodId: id } })
  if (orderCount > 0)
    throw new Error(`Nelze smazat – způsob platby je použit v ${orderCount} objednávkách.`)

  await prisma.paymentMethod.delete({ where: { id } })
  revalidatePath(PATH)
}
