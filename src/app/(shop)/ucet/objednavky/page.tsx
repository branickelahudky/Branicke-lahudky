import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireCustomer } from '@/lib/customer-auth'
import { ownOrdersWhere } from '@/lib/customer-orders'
import { formatCZK } from '@/lib/pricing'
import { STATUS_LABELS } from '@/lib/order-status'
import { AccountNav } from '../_components/AccountNav'
import { LogoutButton } from '../_components/ProfileForms'

export const metadata: Metadata = {
  title: 'Moje objednávky',
  robots: { index: false },
}

export default async function ObjednavkyPage() {
  const { customer } = await requireCustomer('/ucet/objednavky')

  const orders = await prisma.order.findMany({
    where: ownOrdersWhere(customer),
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      totalWithVat: true,
      items: { select: { id: true }, take: 1 },
    },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-shop-fg">Moje objednávky</h1>
        <LogoutButton />
      </div>

      <div className="mb-6">
        <AccountNav active="objednavky" />
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <p className="mb-3 text-4xl">🛒</p>
          <p className="text-sm text-shop-muted">
            Zatím tu žádné objednávky nemáme. Až nakoupíte, uvidíte je zde.
          </p>
          <Link href="/" className="mt-5 inline-block rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold/90">
            Do obchodu
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <ul className="divide-y divide-stone-100">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/ucet/objednavky/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 transition hover:bg-gold/5"
                >
                  <span>
                    <span className="block text-sm font-bold text-shop-fg">{o.orderNumber}</span>
                    <span className="block text-xs text-shop-muted">
                      {o.createdAt.toLocaleDateString('cs-CZ')}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-shop-muted">
                      {STATUS_LABELS[o.status]}
                    </span>
                    <span className="text-sm font-bold text-shop-fg">
                      {formatCZK(Number(o.totalWithVat))}
                    </span>
                    <svg className="h-4 w-4 text-shop-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
