// Souhlas s cookies — sdílené konstanty a klientské utily.
// Web zatím žádné sledovací skripty nemá; volbu jen ukládáme.
// Až se přidá analytika, bude se ptát hasAnalyticsConsent().

export const CONSENT_COOKIE = 'cookie_consent'
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365 // ~12 měsíců
export type ConsentValue = 'accepted' | 'rejected'

/** Přečte uloženou volbu (jen na klientovi; na serveru čti cookie přes next/headers). */
export function getConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(accepted|rejected)`)
  )
  if (match) return match[1] as ConsentValue
  try {
    const stored = localStorage.getItem(CONSENT_COOKIE)
    if (stored === 'accepted' || stored === 'rejected') return stored
  } catch {
    // localStorage nemusí být dostupné (private mode) — cookie stačí
  }
  return null
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === 'accepted'
}
