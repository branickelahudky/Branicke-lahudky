import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireCustomer } from '@/lib/customer-auth'
import { ownOrdersWhere } from '@/lib/customer-orders'
import { formatCZK } from '@/lib/pricing'
import { STATUS_LABELS } from '@/lib/order-status'

export const metadata: Metadata = {
  title: 'Detail objednávky',
  robots: { index: false },
}

function unitLabel(unit: string): string {
  if (unit === 'KG') return 'kg'
  if (unit === 'KS') return 'ks'
  return unit.toLowerCase()
}

type AddressSnapshot = {
  firstName?: string
  lastName?: string
  street?: string
  city?: string
  postalCode?: string
}

export default async function ObjednavkaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { customer } = await requireCustomer('/ucet/objednavky')

  // Vlastnictví se vynucuje přímo v dotazu — cizí ID vrátí 404
  const order = await prisma.order.findFirst({
    where: { AND: [{ id }, ownOrdersWhere(customer)] },
    include: {
      items: {
        select: {
          id: true, productName: true, variantName: true,
          quantity: true, unit: true, lineTotalWithVat: true,
        },
      },
    },
  })

  if (!order) notFound()

  const addr = (order.shippingAddressSnapshot ?? {}) as AddressSnapshot

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/ucet/objednavky" className="mb-4 inline-flex items-center gap-1 text-sm text-shop-muted hover:text-gold">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zpět na objednávky
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-shop-fg">Objednávka {order.orderNumber}</h1>
        <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-medium text-shop-fg">
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-shop-fg">Položky</h2>
          <ul className="divide-y divide-stone-100">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="min-w-0 text-shop-fg">
                  {i.productName}{i.variantName ? ` – ${i.variantName}` : ''}
                  <span className="ml-2 text-xs text-shop-muted">{i.quantity} {unitLabel(i.unit)}</span>
                </span>
                <span className="shrink-0 font-medium text-shop-fg">{formatCZK(Number(i.lineTotalWithVat))}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-shop-muted">Doprava – {order.shippingMethodName}</dt>
              <dd className="text-shop-fg">
                {Number(order.shippingPriceWithVat) > 0 ? formatCZK(Number(order.shippingPriceWithVat)) : 'Zdarma'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-shop-muted">Platba – {order.paymentMethodName}</dt>
              <dd className="text-shop-fg">
                {Number(order.paymentFeeWithVat) > 0 ? formatCZK(Number(order.paymentFeeWithVat)) : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.5">
              <dt className="text-base font-bold text-shop-fg">Celkem</dt>
              <dd className="text-xl font-bold text-gold">{formatCZK(Number(order.totalWithVat))}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-shop-fg">Doručení</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-shop-muted">Datum objednání</dt>
              <dd className="text-shop-fg">{order.createdAt.toLocaleDateString('cs-CZ')}</dd>
            </div>
            {addr.street && (
              <div className="flex justify-between gap-4">
                <dt className="text-shop-muted">Adresa</dt>
                <dd className="text-right text-shop-fg">
                  {addr.firstName} {addr.lastName}<br />
                  {addr.street}, {addr.postalCode} {addr.city}
                </dd>
              </div>
            )}
            {order.preferredDeliveryDate && (
              <div className="flex justify-between gap-4">
                <dt className="text-shop-muted">Přání k termínu</dt>
                <dd className="text-shop-fg">
                  {order.preferredDeliveryDate.toLocaleDateString('cs-CZ')}
                  {order.deliveryTimeSlot ? ` (${order.deliveryTimeSlot})` : ''}
                </dd>
              </div>
            )}
            {order.customerNote && (
              <div className="flex justify-between gap-4">
                <dt className="text-shop-muted">Poznámka</dt>
                <dd className="text-right text-shop-fg">{order.customerNote}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
  )
}
