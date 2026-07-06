// Zákaznická autentizace — ZCELA ODDĚLENÁ od admin auth (src/lib/auth.ts).
// Jiná cookie (customer_session), jiná tabulka (CustomerSession).
// Zákaznická session NIKDY nesmí otevřít /admin a naopak.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const COOKIE_NAME = 'customer_session'
const SESSION_DAYS = 30
const BCRYPT_ROUNDS = 12

export async function hashCustomerPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyCustomerPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function createCustomerSession(
  customerId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.customerSession.create({
    data: { token, customerId, expiresAt, ipAddress, userAgent },
  })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })

  return token
}

export type CustomerSessionData = {
  customer: {
    id: string
    email: string
    firstName: string
    lastName: string
    phone: string | null
    emailVerified: Date | null
    isBusinessCustomer: boolean
    companyName: string | null
    companyId: string | null
    vatId: string | null
    acceptsMarketing: boolean
    passwordHash: string | null
    isAccountDisabled: boolean
    googleId: string | null
  }
}

export async function getCustomerSession(): Promise<CustomerSessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const session = await prisma.customerSession.findUnique({
    where: { token },
    include: {
      customer: {
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true,
          emailVerified: true, isBusinessCustomer: true, companyName: true,
          companyId: true, vatId: true, acceptsMarketing: true, passwordHash: true,
          isAccountDisabled: true, googleId: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.expiresAt < new Date()) {
    await prisma.customerSession.delete({ where: { token } }).catch(() => {})
    return null
  }

  // Pojistka — deaktivace sice sessions maže, ale kdyby nějaká přežila,
  // deaktivovaný účet nesmí zůstat přihlášený
  if (session.customer.isAccountDisabled) {
    await prisma.customerSession.delete({ where: { token } }).catch(() => {})
    return null
  }

  return { customer: session.customer }
}

/** Guard pro stránky účtu — nepřihlášeného pošle na přihlášení s návratem zpět. */
export async function requireCustomer(from?: string): Promise<CustomerSessionData> {
  const session = await getCustomerSession()
  if (!session) {
    redirect(from ? `/ucet/prihlaseni?from=${encodeURIComponent(from)}` : '/ucet/prihlaseni')
  }
  return session
}

export async function destroyCustomerSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token) {
    await prisma.customerSession.delete({ where: { token } }).catch(() => {})
  }
  cookieStore.delete(COOKIE_NAME)
}

/** Zneplatní všechny sessions zákazníka (po změně/resetu hesla). */
export async function destroyAllCustomerSessions(customerId: string): Promise<void> {
  await prisma.customerSession.deleteMany({ where: { customerId } }).catch(() => {})
}

/** Ochrana proti open redirectu — povolíme jen interní cesty. */
export function safeInternalPath(path: string | undefined | null, fallback = '/ucet'): string {
  if (path && path.startsWith('/') && !path.startsWith('//')) return path
  return fallback
}
