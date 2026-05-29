'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession } from '@/lib/auth'
import { logAdminAction } from '@/lib/admin-audit'

// VAROVÁNÍ: In-memory rate limit funguje pouze na single-server deploymentu.
// Pro Vercel/serverless přepiš na Vercel KV / Upstash Redis — každý worker
// má vlastní Map a limity se nesdílejí mezi instancemi.
// Pro lokální vývoj a self-hosted VPS toto řešení stačí.
const loginAttempts = new Map<string, number[]>()
const WINDOW_MS = 15 * 60 * 1000 // 15 minut
const MAX_ATTEMPTS = 5

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const key = email.toLowerCase()
  const timestamps = (loginAttempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (timestamps.length >= MAX_ATTEMPTS) {
    loginAttempts.set(key, timestamps)
    return false // blokováno
  }
  loginAttempts.set(key, [...timestamps, now])
  return true // povoleno
}

const ERROR_URL = '/prihlaseni-admin?chyba=1'

export async function loginAction(formData: FormData) {
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''

  if (!checkRateLimit(email)) {
    redirect(ERROR_URL)
  }

  const user = await prisma.adminUser.findUnique({ where: { email } })

  // Pokud uživatel neexistuje, přidáme umělé zpoždění odpovídající době bcrypt
  // — útočník nemůže odlišit "e-mail neexistuje" od "špatné heslo" podle doby odpovědi
  let valid = false
  if (user) {
    valid = await verifyPassword(password, user.passwordHash)
  } else {
    await new Promise<void>((r) => setTimeout(r, 250))
  }

  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() ?? headerStore.get('x-real-ip') ?? 'unknown'
  const userAgent = headerStore.get('user-agent') ?? undefined

  if (!user || !user.isActive || user.status !== 'ACTIVE' || !valid) {
    await logAdminAction(user?.id ?? null, 'LOGIN_FAILED', null, { email }, ip, userAgent)
    redirect(ERROR_URL)
  }

  await createSession(user.id, ip, userAgent)
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  })
  await logAdminAction(user.id, 'LOGIN', null, null, ip, userAgent)

  redirect('/admin')
}
