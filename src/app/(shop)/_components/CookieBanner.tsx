import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { CONSENT_COOKIE } from '@/lib/cookie-consent'
import { CookieBannerClient } from './CookieBannerClient'

const FALLBACK_TEXT =
  'Používáme cookies pro správné fungování webu a měření návštěvnosti.'

// Rozhoduje se server-side z cookie, aby lišta neblikla uživateli,
// který už volbu provedl.
export async function CookieBanner() {
  const cookieStore = await cookies()
  const consent = cookieStore.get(CONSENT_COOKIE)?.value
  if (consent === 'accepted' || consent === 'rejected') return null

  const settings = await prisma.cookieSettings.findFirst({
    include: { policyPage: { select: { slug: true, isPublished: true } } },
  })
  if (!settings?.enabled) return null

  return (
    <CookieBannerClient
      title={settings.bannerTitle}
      text={settings.bannerText?.trim() || FALLBACK_TEXT}
      acceptLabel={settings.acceptAllLabel}
      rejectLabel={settings.rejectLabel}
      policyHref={settings.policyPage?.isPublished ? `/${settings.policyPage.slug}` : null}
    />
  )
}
