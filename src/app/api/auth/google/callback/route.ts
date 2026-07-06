// GET /api/auth/google/callback — návrat z Googlu.
// Ověří state proti httpOnly cookie, vymění kód server-side (PKCE),
// ověří id_token a přihlásí/propojí/založí zákazníka. Používá STEJNOU
// CustomerSession jako přihlášení heslem — oddělenou od admin sessions.
//
// Logika propojení účtů:
//   1. Customer s googleId existuje → přihlásit
//   2. googleId nikde, e-mail v DB existuje:
//      a) Google e-mail ověřený → propojit (googleId + e-mail ověřen);
//         heslo účtu dál funguje
//      b) neověřený → NEpropojovat (převzetí cizího účtu přes neověřený
//         e-mail), poslat na přihlášení heslem / obnovu hesla
//   3. E-mail neexistuje → založit účet bez hesla (nastaví si ho přes
//      zapomenuté heslo)
//   4. Deaktivovaný účet → nepřihlašovat

import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createCustomerSession, safeInternalPath } from '@/lib/customer-auth'
import {
  googleOAuthConfigured,
  decodeOAuthState,
  exchangeCodeAndVerify,
  OAUTH_STATE_COOKIE,
  type GoogleProfile,
} from '@/lib/google-oauth'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const fail = (chyba: string) =>
    NextResponse.redirect(`${origin}/ucet/prihlaseni?chyba=${chyba}`)

  if (!googleOAuthConfigured()) return fail('google')

  // State cookie se čte a hned maže — každý pokus o flow je jednorázový
  const cookieStore = await cookies()
  const stored = decodeOAuthState(cookieStore.get(OAUTH_STATE_COOKIE)?.value)
  cookieStore.delete(OAUTH_STATE_COOKIE)

  // Uživatel na Googlu zrušil přihlášení
  if (req.nextUrl.searchParams.get('error')) return fail('google-zruseno')

  const code = req.nextUrl.searchParams.get('code')
  const returnedState = req.nextUrl.searchParams.get('state')
  if (!code || !stored || !returnedState || returnedState !== stored.state) {
    return fail('google')
  }

  let profile: GoogleProfile
  try {
    profile = await exchangeCodeAndVerify(origin, code, stored)
  } catch (e) {
    console.error('Google OAuth callback:', e)
    return fail('google')
  }

  // ─── Propojení účtů ──────────────────────────────────────────────
  let customerId: string

  const byGoogleId = await prisma.customer.findUnique({
    where: { googleId: profile.googleId },
    select: { id: true, isAccountDisabled: true },
  })

  if (byGoogleId) {
    if (byGoogleId.isAccountDisabled) return fail('deaktivovan')
    customerId = byGoogleId.id
  } else {
    const byEmail = await prisma.customer.findUnique({
      where: { email: profile.email },
      select: { id: true, isAccountDisabled: true, emailVerified: true },
    })

    if (byEmail) {
      // Propojit smíme jen e-mail, který Google ověřil — jinak by šel
      // převzít cizí účet přes neověřenou adresu
      if (!profile.emailVerified) return fail('google-neovereny')
      if (byEmail.isAccountDisabled) return fail('deaktivovan')

      await prisma.customer.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.googleId,
          emailVerified: byEmail.emailVerified ?? new Date(),
        },
      })
      customerId = byEmail.id
    } else {
      const created = await prisma.customer.create({
        data: {
          email: profile.email,
          googleId: profile.googleId,
          firstName: profile.givenName?.trim() || 'Zákazník',
          lastName: profile.familyName?.trim() || '',
          emailVerified: profile.emailVerified ? new Date() : null,
          // passwordHash zůstává null — heslo si lze nastavit přes
          // „Zapomenuté heslo" (F13 flow)
        },
        select: { id: true },
      })
      customerId = created.id
    }
  }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
  const userAgent = h.get('user-agent') ?? undefined
  await createCustomerSession(customerId, ip, userAgent)
  await prisma.customer.update({
    where: { id: customerId },
    data: { lastLoginAt: new Date() },
  })

  return NextResponse.redirect(`${origin}${safeInternalPath(stored.from)}`)
}
