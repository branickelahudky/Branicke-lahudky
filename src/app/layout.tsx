import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import { prisma } from '@/lib/prisma'
import {
  getSeoSettings,
  SITE_URL,
  SITE_NAME,
  FALLBACK_SITE_TITLE,
  FALLBACK_TITLE_TEMPLATE,
  FALLBACK_DESCRIPTION,
} from '@/lib/seo'
import './globals.css'

// Brandový font — self-hosted přes next/font (žádné requesty na Google).
// latin-ext je nutný kvůli češtině (ěščřžýáíé).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  // Favicon z adminu (Vzhled → Identita) má přednost; fallback je
  // /favicon.png vygenerovaný z loga MARKES.
  // Titulky a popis se berou z adminu (Vzhled → SEO) s fallbacky na
  // původní hodnoty.
  const [identity, seo] = await Promise.all([
    prisma.siteIdentity.findFirst({ select: { faviconUrl: true } }).catch(() => null),
    getSeoSettings(),
  ])

  const siteTitle = seo?.siteTitle?.trim() || FALLBACK_SITE_TITLE
  const description = seo?.metaDescription?.trim() || FALLBACK_DESCRIPTION

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: siteTitle,
      template: seo?.titleTemplate?.includes('%s') ? seo.titleTemplate : FALLBACK_TITLE_TEMPLATE,
    },
    description,
    openGraph: {
      siteName: SITE_NAME,
      locale: 'cs_CZ',
      type: 'website',
      ...(seo?.ogImageUrl ? { images: [{ url: seo.ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
    icons: { icon: identity?.faviconUrl ?? '/favicon.png' },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={jakarta.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  )
}
