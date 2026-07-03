import type { Metadata } from 'next'
import { ForgotPasswordForm } from '../_components/AuthForms'

export const metadata: Metadata = {
  title: 'Zapomenuté heslo',
  robots: { index: false },
}

export default function ZapomenuteHesloPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <h1 className="mb-5 text-center text-2xl font-bold text-shop-fg">Zapomenuté heslo</h1>
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
