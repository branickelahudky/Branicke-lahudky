import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

// Brandový font — self-hosted přes next/font (žádné requesty na Google).
// latin-ext je nutný kvůli češtině (ěščřžýáíé).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Branické lahůdkářství',
    template: '%s | Branické lahůdkářství',
  },
  description:
    'Rodinné řeznictví a lahůdkářství v Praze 4 od roku 1991. Čerstvé maso, uzeniny a originální NYC pastrami.',
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
