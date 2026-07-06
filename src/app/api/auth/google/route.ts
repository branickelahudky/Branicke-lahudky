// GET /api/auth/google — start přihlášení přes Google.
// Vygeneruje state + PKCE + nonce, uloží je do httpOnly cookie (CSRF
// ochrana) a přesměruje na Google. ?from= se propašuje přes cookie.

import { NextRequest, NextResponse } from 'next/server'
import { safeInternalPath } from '@/lib/customer-auth'
import {
  googleOAuthConfigured,
  createOAuthState,
  encodeOAuthState,
  buildAuthUrl,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
} from '@/lib/google-oauth'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(`${origin}/ucet/prihlaseni?chyba=google`)
  }

  const from = safeInternalPath(req.nextUrl.searchParams.get('from'))
  const state = createOAuthState(from)

  const res = NextResponse.redirect(buildAuthUrl(origin, state))
  res.cookies.set(OAUTH_STATE_COOKIE, encodeOAuthState(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE,
  })
  return res
}
