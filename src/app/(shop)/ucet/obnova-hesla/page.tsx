import type { Metadata } from 'next'
import Link from 'next/link'
import { validateCustomerResetToken } from '@/lib/customer-reset-email'
import { ResetPasswordForm } from '../_components/AuthForms'

export const metadata: Metadata = {
  title: 'Nastavení nového hesla',
  robots: { index: false },
}

export default async function ObnovaHeslaPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  const customerId = t ? await validateCustomerResetToken(t) : null

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        {customerId && t ? (
          <>
            <h1 className="mb-5 text-center text-2xl font-bold text-shop-fg">Nastavení nového hesla</h1>
            <ResetPasswordForm token={t} />
          </>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-4xl">⏰</p>
            <h1 className="text-xl font-bold text-shop-fg">Odkaz je neplatný nebo vypršel</h1>
            <p className="text-sm text-shop-muted">
              Odkazy na nastavení hesla platí 60 minut a dají se použít jen jednou.
              Požádejte si prosím o nový.
            </p>
            <Link
              href="/ucet/zapomenute-heslo"
              className="inline-block rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold/90"
            >
              Poslat nový odkaz
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
