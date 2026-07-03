'use server'

// Server actions zákaznického účtu. Bezpečnostní zásady převzaté z admin
// loginu: rate limit, jednotná hláška „Nesprávný e-mail nebo heslo",
// umělé zpoždění při neexistujícím e-mailu (timing attack).

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  createCustomerSession,
  destroyCustomerSession,
  destroyAllCustomerSessions,
  requireCustomer,
  safeInternalPath,
} from '@/lib/customer-auth'
import {
  sendCustomerPasswordResetEmail,
  validateCustomerResetToken,
  consumeCustomerResetToken,
} from '@/lib/customer-reset-email'

export type ActionState = {
  error?: string
  /** Registrace na e-mail známý z prodejny (bez hesla) — poslán odkaz na nastavení hesla */
  claimSent?: boolean
  /** Zapomenuté heslo — potvrzení odeslání (vždy, bez prozrazení existence účtu) */
  sent?: boolean
  /** Uložení profilu/hesla proběhlo */
  saved?: boolean
} | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

// In-memory rate limit — stejná poznámka jako u admin loginu: platí pro
// single-server. Pro serverless nasazení přepsat na sdílené úložiště.
const attempts = new Map<string, number[]>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const stamps = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (stamps.length >= MAX_ATTEMPTS) {
    attempts.set(key, stamps)
    return false
  }
  attempts.set(key, [...stamps, now])
  return true
}

async function requestMeta() {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
  const userAgent = h.get('user-agent') ?? undefined
  return { ip, userAgent }
}

// ─── Registrace ────────────────────────────────────────────────────

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const firstName = ((formData.get('firstName') as string) ?? '').trim()
  const lastName = ((formData.get('lastName') as string) ?? '').trim()
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''
  const terms = formData.get('terms') === 'on'
  const from = safeInternalPath(formData.get('from') as string)

  if (!firstName || !lastName) return { error: 'Vyplňte prosím jméno a příjmení.' }
  if (!EMAIL_RE.test(email)) return { error: 'Zadejte platný e-mail.' }
  if (password.length < MIN_PASSWORD) return { error: `Heslo musí mít alespoň ${MIN_PASSWORD} znaků.` }
  if (!terms) return { error: 'Pro registraci je potřeba souhlasit s obchodními podmínkami.' }
  if (!checkRateLimit(`reg:${email}`)) return { error: 'Příliš mnoho pokusů. Zkuste to prosím za 15 minut.' }

  const existing = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  })

  if (existing) {
    if (existing.passwordHash) {
      return { error: 'Účet s tímto e-mailem už existuje, přihlaste se.' }
    }
    // Importovaný zákazník (Shoptet/prodejna) bez hesla — NEZAKLÁDAT duplicitu,
    // nastavení hesla přes e-mailový odkaz zároveň ověří vlastnictví e-mailu.
    await sendCustomerPasswordResetEmail(existing.id, { claimAccount: true })
    return { claimSent: true }
  }

  const customer = await prisma.customer.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash: await hashCustomerPassword(password),
    },
  })

  const { ip, userAgent } = await requestMeta()
  await createCustomerSession(customer.id, ip, userAgent)
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  })

  redirect(from)
}

// ─── Přihlášení ────────────────────────────────────────────────────

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''
  const from = safeInternalPath(formData.get('from') as string)

  if (!checkRateLimit(`login:${email}`)) {
    return { error: 'Příliš mnoho pokusů. Zkuste to prosím za 15 minut.' }
  }

  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isAccountDisabled: true },
  })

  let valid = false
  if (customer?.passwordHash) {
    valid = await verifyCustomerPassword(password, customer.passwordHash)
  } else {
    // stejná doba odpovědi jako při ověřování hesla
    await new Promise<void>((r) => setTimeout(r, 250))
  }

  if (!customer || !valid) {
    return { error: 'Nesprávný e-mail nebo heslo.' }
  }

  // Hlásíme až PO ověření hesla — existenci deaktivovaného účtu
  // se nesmí dozvědět nikdo, kdo heslo nezná
  if (customer.isAccountDisabled) {
    return { error: 'Účet je deaktivován, kontaktujte nás prosím.' }
  }

  const { ip, userAgent } = await requestMeta()
  await createCustomerSession(customer.id, ip, userAgent)
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  })

  redirect(from)
}

// ─── Odhlášení ─────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await destroyCustomerSession()
  redirect('/')
}

// ─── Zapomenuté heslo ──────────────────────────────────────────────

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: 'Zadejte platný e-mail.' }
  if (!checkRateLimit(`forgot:${email}`)) {
    return { error: 'Příliš mnoho pokusů. Zkuste to prosím za 15 minut.' }
  }

  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  })

  if (customer) {
    await sendCustomerPasswordResetEmail(customer.id, {
      claimAccount: !customer.passwordHash,
    })
  }

  // Vždy stejná odpověď — neprozrazujeme, které e-maily máme v databázi
  return { sent: true }
}

// ─── Obnova hesla (z e-mailového odkazu) ───────────────────────────

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = (formData.get('token') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''
  const passwordConfirm = (formData.get('passwordConfirm') as string) ?? ''

  if (password.length < MIN_PASSWORD) return { error: `Heslo musí mít alespoň ${MIN_PASSWORD} znaků.` }
  if (password !== passwordConfirm) return { error: 'Hesla se neshodují.' }

  const customerId = await validateCustomerResetToken(token)
  if (!customerId) {
    return { error: 'Odkaz je neplatný nebo vypršel. Požádejte prosím o nový.' }
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      passwordHash: await hashCustomerPassword(password),
      // odkaz přišel na e-mail zákazníka → e-mail je tímto ověřený
      emailVerified: new Date(),
    },
  })
  await consumeCustomerResetToken(token)
  await destroyAllCustomerSessions(customerId)

  redirect('/ucet/prihlaseni?zprava=heslo-nastaveno')
}

// ─── Úprava profilu ────────────────────────────────────────────────

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { customer } = await requireCustomer('/ucet')

  const firstName = ((formData.get('firstName') as string) ?? '').trim()
  const lastName = ((formData.get('lastName') as string) ?? '').trim()
  const phone = ((formData.get('phone') as string) ?? '').trim()
  const isBusiness = formData.get('isBusiness') === 'on'
  const companyName = ((formData.get('companyName') as string) ?? '').trim()
  const companyId = ((formData.get('companyId') as string) ?? '').trim()
  const vatId = ((formData.get('vatId') as string) ?? '').trim()

  const street = ((formData.get('street') as string) ?? '').trim()
  const city = ((formData.get('city') as string) ?? '').trim()
  const postalCode = ((formData.get('postalCode') as string) ?? '').trim()

  if (!firstName || !lastName) return { error: 'Jméno a příjmení nesmí být prázdné.' }
  if (isBusiness && !companyName) return { error: 'U firemního účtu vyplňte název firmy.' }
  if (isBusiness && !/^\d{8}$/.test(companyId)) return { error: 'IČO má přesně 8 číslic.' }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      firstName,
      lastName,
      phone: phone || null,
      isBusinessCustomer: isBusiness,
      companyName: isBusiness ? companyName : null,
      companyId: isBusiness ? companyId : null,
      vatId: isBusiness && vatId ? vatId : null,
    },
  })

  // Výchozí adresa (jedna, typ BOTH) — vyplněná celá, nebo žádná
  const hasAddress = street && city && postalCode
  const existingDefault = await prisma.address.findFirst({
    where: { customerId: customer.id, isDefault: true },
  })

  if (hasAddress) {
    const addressData = {
      firstName, lastName, street, city, postalCode,
      country: 'CZ',
      phone: phone || null,
      type: 'BOTH' as const,
      isDefault: true,
    }
    if (existingDefault) {
      await prisma.address.update({ where: { id: existingDefault.id }, data: addressData })
    } else {
      await prisma.address.create({ data: { ...addressData, customerId: customer.id } })
    }
  } else if (street || city || postalCode) {
    return { error: 'Adresa musí být vyplněná celá (ulice, město i PSČ), nebo úplně prázdná.' }
  }

  return { saved: true }
}

// ─── Změna hesla ───────────────────────────────────────────────────

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { customer } = await requireCustomer('/ucet')

  const oldPassword = (formData.get('oldPassword') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''
  const passwordConfirm = (formData.get('passwordConfirm') as string) ?? ''

  if (!customer.passwordHash) return { error: 'Účet zatím nemá heslo — nastavte si ho přes „Zapomenuté heslo".' }
  if (password.length < MIN_PASSWORD) return { error: `Nové heslo musí mít alespoň ${MIN_PASSWORD} znaků.` }
  if (password !== passwordConfirm) return { error: 'Nová hesla se neshodují.' }

  const valid = await verifyCustomerPassword(oldPassword, customer.passwordHash)
  if (!valid) return { error: 'Současné heslo není správné.' }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: await hashCustomerPassword(password) },
  })

  // Odhlásit všechna zařízení a založit novou session pro to aktuální
  await destroyAllCustomerSessions(customer.id)
  const { ip, userAgent } = await requestMeta()
  await createCustomerSession(customer.id, ip, userAgent)

  return { saved: true }
}
