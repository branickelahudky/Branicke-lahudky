import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

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
    <html lang="cs">
      <body className="antialiased">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  )
}
