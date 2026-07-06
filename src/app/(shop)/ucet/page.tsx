import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requireCustomer } from '@/lib/customer-auth'
import { ProfileForm, ChangePasswordForm, LogoutButton, type ProfileData } from './_components/ProfileForms'
import { AccountNav } from './_components/AccountNav'

export const metadata: Metadata = {
  title: 'Můj účet',
  robots: { index: false },
}

export default async function UcetPage() {
  const { customer } = await requireCustomer('/ucet')

  const defaultAddress = await prisma.address.findFirst({
    where: { customerId: customer.id, isDefault: true },
    select: { street: true, city: true, postalCode: true },
  })

  const profile: ProfileData = {
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone ?? '',
    isBusiness: customer.isBusinessCustomer,
    companyName: customer.companyName ?? '',
    companyId: customer.companyId ?? '',
    vatId: customer.vatId ?? '',
    street: defaultAddress?.street ?? '',
    city: defaultAddress?.city ?? '',
    postalCode: defaultAddress?.postalCode ?? '',
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-shop-fg">
          Dobrý den, {customer.firstName}!
        </h1>
        <LogoutButton />
      </div>

      <div className="mb-6">
        <AccountNav active="profil" />
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-shop-fg">Moje údaje</h2>
            {customer.googleId && (
              <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-shop-muted">
                Propojeno s Google
              </span>
            )}
          </div>
          <ProfileForm profile={profile} />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-shop-fg">Změna hesla</h2>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  )
}
