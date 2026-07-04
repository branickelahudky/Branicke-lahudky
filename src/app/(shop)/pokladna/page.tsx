import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCustomerSession } from '@/lib/customer-auth'
import { CheckoutClient, type ShippingOption, type PaymentOption, type CheckoutPrefill } from './_components/CheckoutClient'

export const metadata: Metadata = {
  title: 'Pokladna',
  robots: { index: false },
}

// Dopravy a platby se spravují v adminu — nesmí se zapéct do statického buildu
export const dynamic = 'force-dynamic'

export default async function PokladnaPage() {
  const [shippingMethods, allPaymentMethods, termsPage, customerSession] = await Promise.all([
    prisma.shippingMethod.findMany({
      // ČR i Slovensko — pokladna filtruje podle zvolené země doručení
      where: { isActive: true, availableCountries: { hasSome: ['CZ', 'SK'] } },
      orderBy: { sortOrder: 'asc' },
      include: {
        allowedPaymentMethods: { select: { paymentMethodId: true } },
        weightTiers: { orderBy: { maxWeightKg: 'asc' } },
      },
    }),
    // Platební brána zatím není — nabízíme jen ruční platby (dobírka/hotovost/převod)
    prisma.paymentMethod.findMany({
      where: { isActive: true, provider: 'MANUAL' },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.page.findUnique({
      where: { slug: 'obchodni-podminky' },
      select: { slug: true, title: true },
    }),
    getCustomerSession(),
  ])

  // Přihlášenému předvyplníme kontakt + výchozí adresu z profilu.
  // customerId se do objednávky NEPOSÍLÁ z klienta — API si ho bere ze session.
  let prefill: CheckoutPrefill | null = null
  if (customerSession) {
    const c = customerSession.customer
    const defaultAddress = await prisma.address.findFirst({
      where: { customerId: c.id, isDefault: true },
      select: { street: true, city: true, postalCode: true },
    })
    prefill = {
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone ?? '',
      street: defaultAddress?.street ?? '',
      city: defaultAddress?.city ?? '',
      postalCode: defaultAddress?.postalCode ?? '',
      isBusiness: c.isBusinessCustomer,
      companyName: c.companyName ?? '',
      companyId: c.companyId ?? '',
      vatId: c.vatId ?? '',
    }
  }

  const paymentOptions: PaymentOption[] = allPaymentMethods.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    type: p.type,
    feeWithVat: Number(p.feeWithVat),
    vatRate: Number(p.vatRate),
  }))

  const manualIds = new Set(paymentOptions.map((p) => p.id))

  const shippingOptions: ShippingOption[] = shippingMethods.map((s) => {
    const allowed = s.allowedPaymentMethods
      .map((l) => l.paymentMethodId)
      .filter((id) => manualIds.has(id))
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      isPickup: s.isPickup,
      estimatedDays: s.estimatedDays,
      priceWithVat: Number(s.priceWithVat),
      vatRate: Number(s.vatRate),
      freeShippingThreshold: s.freeShippingThreshold ? Number(s.freeShippingThreshold) : null,
      maxOrderValue: s.maxOrderValue ? Number(s.maxOrderValue) : null,
      maxWeightKg: s.maxWeightKg ? Number(s.maxWeightKg) : null,
      countries: s.availableCountries,
      usesWeightTiers: s.usesWeightTiers,
      fuelSurchargePercent: Number(s.fuelSurchargePercent),
      defaultItemWeightGrams: s.defaultItemWeightGrams,
      weightTiers: s.weightTiers.map((t) => ({
        maxWeightKg: Number(t.maxWeightKg),
        priceWithVat: Number(t.priceWithVat),
      })),
      // prázdné = doprava nemá nastavené vazby → povolíme všechny ruční platby
      allowedPaymentIds: allowed,
    }
  })

  return (
    <CheckoutClient
      shippingOptions={shippingOptions}
      paymentOptions={paymentOptions}
      termsSlug={termsPage?.slug ?? 'obchodni-podminky'}
      prefill={prefill}
      isLoggedIn={!!customerSession}
    />
  )
}
