'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { logAdminAction } from '@/lib/admin-audit'
import { sendCustomerPasswordResetEmail } from '@/lib/customer-reset-email'

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

// ─── Správa zákaznického účtu (F14) ────────────────────────────────
// Admin NIKDY nevidí ani nenastavuje heslo zákazníka — jen posílá
// odkaz na jeho nastavení. Všechny akce se zapisují do audit logu.

async function auditMeta() {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? undefined
  const userAgent = h.get('user-agent') ?? undefined
  return { ip, userAgent }
}

/**
 * Pošle zákazníkovi odkaz na nastavení/obnovu hesla.
 * U zákazníka bez hesla funguje jako pozvánka k vytvoření účtu.
 */
export async function sendCustomerResetLink(customerId: string) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { email: true, passwordHash: true },
  })
  if (!customer) throw new Error('Zákazník nenalezen.')

  const isInvite = !customer.passwordHash
  const result = await sendCustomerPasswordResetEmail(customerId, { claimAccount: isInvite })
  if (!result.sent) {
    throw new Error(`E-mail se nepodařilo odeslat: ${result.error ?? 'neznámá chyba'}`)
  }

  const { ip, userAgent } = await auditMeta()
  await logAdminAction(
    user.id,
    isInvite ? 'CUSTOMER_ACCOUNT_INVITED' : 'CUSTOMER_RESET_LINK_SENT',
    null,
    { customerId, customerEmail: customer.email },
    ip,
    userAgent,
  )

  const testMode = process.env.EMAIL_TEST_MODE !== 'false'
  return { isInvite, testMode }
}

/** Odhlásí zákazníka ze všech zařízení (např. při ukradeném přístupu). */
export async function revokeCustomerSessions(customerId: string) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { email: true },
  })
  if (!customer) throw new Error('Zákazník nenalezen.')

  const { count } = await prisma.customerSession.deleteMany({ where: { customerId } })

  const { ip, userAgent } = await auditMeta()
  await logAdminAction(
    user.id,
    'CUSTOMER_SESSIONS_REVOKED',
    null,
    { customerId, customerEmail: customer.email, revokedCount: count },
    ip,
    userAgent,
  )

  revalidatePath(`/admin/zakaznici/${customerId}`)
  return { revokedCount: count }
}

/** Deaktivuje/aktivuje zákaznický účet. Deaktivace smaže všechny sessions. */
export async function setCustomerAccountDisabled(customerId: string, disabled: boolean) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { email: true, isAccountDisabled: true },
  })
  if (!customer) throw new Error('Zákazník nenalezen.')
  if (customer.isAccountDisabled === disabled) return { changed: false }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: { isAccountDisabled: disabled },
    }),
    // Deaktivace okamžitě zneplatní všechna přihlášení
    ...(disabled
      ? [prisma.customerSession.deleteMany({ where: { customerId } })]
      : []),
  ])

  const { ip, userAgent } = await auditMeta()
  await logAdminAction(
    user.id,
    disabled ? 'CUSTOMER_ACCOUNT_DISABLED' : 'CUSTOMER_ACCOUNT_ENABLED',
    null,
    { customerId, customerEmail: customer.email },
    ip,
    userAgent,
  )

  revalidatePath('/admin/zakaznici')
  revalidatePath(`/admin/zakaznici/${customerId}`)
  return { changed: true }
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
