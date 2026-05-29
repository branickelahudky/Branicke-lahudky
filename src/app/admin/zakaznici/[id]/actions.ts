'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

export type AddressData = {
  id: string | null
  firstName: string
  lastName: string
  street: string
  city: string
  postalCode: string
  country: string
}

export type UpdateCustomerData = {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  internalNote: string | null
  isBusinessCustomer: boolean
  companyName: string | null
  companyId: string | null
  vatId: string | null
  billing: AddressData | null
  shipping: AddressData | null
}

export async function updateCustomer(customerId: string, data: UpdateCustomerData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  if (!data.firstName.trim()) throw new Error('Křestní jméno je povinné.')
  if (!data.lastName.trim()) throw new Error('Příjmení je povinné.')
  if (!data.email.trim()) throw new Error('E-mail je povinný.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
    throw new Error('Neplatný formát e-mailu.')
  if (data.isBusinessCustomer && !data.companyName?.trim())
    throw new Error('Název společnosti je povinný pro B2B zákazníka.')
  if (data.isBusinessCustomer && data.companyId && !/^\d{8}$/.test(data.companyId.trim()))
    throw new Error('IČO musí obsahovat přesně 8 číslic.')

  const existingEmail = await prisma.customer.findFirst({
    where: { email: data.email.toLowerCase().trim(), id: { not: customerId } },
    select: { id: true },
  })
  if (existingEmail) throw new Error('Tento e-mail je již použit jiným zákazníkem.')

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim() || null,
      internalNote: data.internalNote?.trim() || null,
      isBusinessCustomer: data.isBusinessCustomer,
      companyName: data.companyName?.trim() || null,
      companyId: data.companyId?.trim() || null,
      vatId: data.vatId?.trim() || null,
    },
  })

  if (data.billing?.id) {
    await prisma.address.update({
      where: { id: data.billing.id },
      data: {
        firstName: data.billing.firstName.trim(),
        lastName: data.billing.lastName.trim(),
        street: data.billing.street.trim(),
        city: data.billing.city.trim(),
        postalCode: data.billing.postalCode.trim(),
        country: data.billing.country || 'Česká republika',
      },
    })
  }

  if (data.shipping?.id) {
    await prisma.address.update({
      where: { id: data.shipping.id },
      data: {
        firstName: data.shipping.firstName.trim(),
        lastName: data.shipping.lastName.trim(),
        street: data.shipping.street.trim(),
        city: data.shipping.city.trim(),
        postalCode: data.shipping.postalCode.trim(),
        country: data.shipping.country || 'Česká republika',
      },
    })
  }

  revalidatePath('/admin/zakaznici')
  revalidatePath(`/admin/zakaznici/${customerId}`)
}

export async function deleteCustomer(customerId: string) {
  const { user } = await requireAuth()
  if (user.role !== 'OWNER') throw new Error('Smazat zákazníka může pouze majitel.')

  const orderCount = await prisma.order.count({ where: { customerId } })
  if (orderCount > 0) {
    throw new Error(
      `Nelze smazat zákazníka – má ${orderCount} objednávek. Skryjte ho místo toho.`,
    )
  }

  await prisma.$transaction([
    prisma.address.deleteMany({ where: { customerId } }),
    prisma.customer.delete({ where: { id: customerId } }),
  ])

  revalidatePath('/admin/zakaznici')
}

export async function deleteCustomerAddress(addressId: string) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  const address = await prisma.address.findUnique({
    where: { id: addressId },
    select: { customerId: true },
  })
  if (!address) throw new Error('Adresa nenalezena.')

  const addrCount = await prisma.address.count({ where: { customerId: address.customerId } })
  if (addrCount <= 1) throw new Error('Nelze smazat jedinou adresu zákazníka.')

  await prisma.address.delete({ where: { id: addressId } })

  revalidatePath('/admin/zakaznici')
  revalidatePath(`/admin/zakaznici/${address.customerId}`)
}
