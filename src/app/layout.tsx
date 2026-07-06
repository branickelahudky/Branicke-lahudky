import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import { prisma } from '@/lib/prisma'
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
  // /favicon.png vygenerovaný z loga MARKES
  const identity = await prisma.siteIdentity
    .findFirst({ select: { faviconUrl: true } })
    .catch(() => null)

  return {
    title: {
      default: 'Branické lahůdkářství — čerstvé maso, ryby a lahůdky',
      template: '%s | Branické lahůdkářství',
    },
    description:
      'Rodinné řeznictví a lahůdkářství v Praze 4 od roku 1991. Čerstvé maso, ryby, uzeniny a poctivé lahůdky s rozvozem po ČR i Slovensku.',
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
