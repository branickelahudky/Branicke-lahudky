// Přihlášení přes Google — OAuth 2.0 / OpenID Connect (authorization code
// + PKCE). Napojuje se na STEJNÝ Customer model a CustomerSession jako
// přihlášení heslem (src/lib/customer-auth.ts) — žádný paralelní systém.
//
// Bez GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET se tlačítko na webu vůbec
// nezobrazí a nic nespadne.

import crypto from 'crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

/** Cookie s OAuth stavem (state + PKCE verifier + nonce + from) po dobu flow. */
export const OAUTH_STATE_COOKIE = 'google_oauth_state'
export const OAUTH_STATE_MAX_AGE = 10 * 60 // 10 minut

export const CALLBACK_PATH = '/api/auth/google/callback'

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export type OAuthState = {
  state: string
  codeVerifier: string
  nonce: string
  /** Kam se vrátit po přihlášení (?from= mechanismus z F13) */
  from: string
}

export function createOAuthState(from: string): OAuthState {
  return {
    state: crypto.randomBytes(24).toString('base64url'),
    codeVerifier: crypto.randomBytes(48).toString('base64url'),
    nonce: crypto.randomBytes(24).toString('base64url'),
    from,
  }
}

export function encodeOAuthState(s: OAuthState): string {
  return Buffer.from(JSON.stringify(s)).toString('base64url')
}

export function decodeOAuthState(raw: string | undefined): OAuthState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (
      typeof parsed.state === 'string' &&
      typeof parsed.codeVerifier === 'string' &&
      typeof parsed.nonce === 'string' &&
      typeof parsed.from === 'string'
    ) {
      return parsed
    }
  } catch {
    // poškozená cookie → flow se odmítne
  }
  return null
}

/** URL pro redirect na Google souhlasovou obrazovku. */
export function buildAuthUrl(origin: string, s: OAuthState): string {
  const codeChallenge = crypto
    .createHash('sha256')
    .update(s.codeVerifier)
    .digest('base64url')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    response_type: 'code',
    scope: 'openid email profile',
    state: s.state,
    nonce: s.nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

export type GoogleProfile = {
  googleId: string
  email: string
  emailVerified: boolean
  givenName: string | null
  familyName: string | null
}

// JWKS set se cachuje mezi requesty (module scope) — jose si sám hlídá
// obnovu klíčů podle cache hlaviček Googlu
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))

/**
 * Vymění authorization code za tokeny (server-to-server, s PKCE verifierem)
 * a ověří id_token: podpis proti Google JWKS, iss, aud (client_id), exp
 * a nonce. Vrátí profil, nebo vyhodí chybu.
 */
export async function exchangeCodeAndVerify(
  origin: string,
  code: string,
  s: OAuthState,
): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier: s.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: `${origin}${CALLBACK_PATH}`,
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token endpoint: HTTP ${res.status}`)
  }
  const tokens = (await res.json()) as { id_token?: string }
  if (!tokens.id_token) {
    throw new Error('Google token endpoint: chybí id_token')
  }

  // jwtVerify ověřuje podpis, exp/nbf, issuer i audience
  const { payload } = await jwtVerify(tokens.id_token, googleJwks, {
    issuer: GOOGLE_ISSUERS,
    audience: process.env.GOOGLE_CLIENT_ID!,
  })

  if (payload.nonce !== s.nonce) {
    throw new Error('id_token: nesouhlasí nonce')
  }
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('id_token: chybí sub nebo email')
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    givenName: typeof payload.given_name === 'string' ? payload.given_name : null,
    familyName: typeof payload.family_name === 'string' ? payload.family_name : null,
  }
}
