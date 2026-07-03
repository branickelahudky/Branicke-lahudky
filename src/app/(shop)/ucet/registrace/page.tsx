import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCustomerSession, safeInternalPath } from '@/lib/customer-auth'
import { RegisterForm } from '../_components/AuthForms'

export const metadata: Metadata = {
  title: 'Registrace',
  robots: { index: false },
}

export default async function RegistracePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams

  if (await getCustomerSession()) {
    redirect(safeInternalPath(from))
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-shop-fg">Založení účtu</h1>
        <p className="mb-5 text-center text-sm text-shop-muted">
          S účtem uvidíte historii objednávek a v pokladně budete mít předvyplněné údaje.
        </p>
        <RegisterForm from={from} />
      </div>
    </div>
  )
}
