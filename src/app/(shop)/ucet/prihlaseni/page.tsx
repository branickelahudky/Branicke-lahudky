import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCustomerSession, safeInternalPath } from '@/lib/customer-auth'
import { LoginForm } from '../_components/AuthForms'
import { GoogleSignIn } from '../_components/GoogleSignIn'

export const metadata: Metadata = {
  title: 'Přihlášení',
  robots: { index: false },
}

const MESSAGES: Record<string, string> = {
  'heslo-nastaveno': 'Heslo je nastavené — teď se můžete přihlásit.',
}

// Chyby z přihlášení přes Google (viz /api/auth/google/callback)
const ERRORS: Record<string, string> = {
  google: 'Přihlášení přes Google se nepodařilo. Zkuste to prosím znovu.',
  'google-zruseno': 'Přihlášení přes Google bylo zrušeno.',
  'google-neovereny':
    'Váš e-mail není u Googlu ověřený, účty proto nemůžeme bezpečně propojit. Přihlaste se heslem nebo použijte obnovu hesla.',
  deaktivovan: 'Účet je deaktivován, kontaktujte nás prosím.',
}

export default async function PrihlaseniPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; zprava?: string; chyba?: string }>
}) {
  const { from, zprava, chyba } = await searchParams

  // Už přihlášený nemá na přihlášení co dělat
  if (await getCustomerSession()) {
    redirect(safeInternalPath(from))
  }

  const message = zprava ? MESSAGES[zprava] : null
  const error = chyba ? ERRORS[chyba] : null

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <h1 className="mb-5 text-center text-2xl font-bold text-shop-fg">Přihlášení</h1>
        {message && (
          <p className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
            {message}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}
        <GoogleSignIn from={from} />
        <LoginForm from={from} />
      </div>
    </div>
  )
}
