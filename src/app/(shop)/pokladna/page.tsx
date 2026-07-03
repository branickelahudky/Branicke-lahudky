import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { CheckoutClient, type ShippingOption, type PaymentOption } from './_components/CheckoutClient'

export const metadata: Metadata = {
  title: 'Pokladna',
  robots: { index: false },
}

// Dopravy a platby se spravují v adminu — nesmí se zapéct do statického buildu
export const dynamic = 'force-dynamic'

export default async function PokladnaPage() {
  const [shippingMethods, allPaymentMethods, termsPage] = await Promise.all([
    prisma.shippingMethod.findMany({
      where: { isActive: true, availableCountries: { has: 'CZ' } },
      orderBy: { sortOrder: 'asc' },
      include: {
        allowedPaymentMethods: { select: { paymentMethodId: true } },
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
  ])

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
      // prázdné = doprava nemá nastavené vazby → povolíme všechny ruční platby
      allowedPaymentIds: allowed,
    }
  })

  return (
    <CheckoutClient
      shippingOptions={shippingOptions}
      paymentOptions={paymentOptions}
      termsSlug={termsPage?.slug ?? 'obchodni-podminky'}
    />
  )
}
