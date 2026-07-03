import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatCZK } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Děkujeme za objednávku',
  robots: { index: false },
}

function unitLabel(unit: string): string {
  if (unit === 'KG') return 'kg'
  if (unit === 'KS') return 'ks'
  return unit.toLowerCase()
}

function isBankTransfer(pm: { code: string; type: string | null } | null): boolean {
  if (!pm) return false
  return pm.type === 'transfer' || pm.code.toUpperCase().includes('TRANSFER')
}

// Objednávka se hledá výhradně přes neuhodnutelný publicToken (?t=…) —
// holé ID ani číslo objednávky cizí objednávku nezobrazí.
export default async function DekujemePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams

  const order = t
    ? await prisma.order.findUnique({
        where: { publicToken: t },
        include: {
          items: {
            select: {
              id: true, productName: true, variantName: true,
              quantity: true, unit: true, lineTotalWithVat: true,
            },
          },
          paymentMethod: { select: { code: true, type: true } },
        },
      })
    : null

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <p className="mb-4 text-5xl">🔍</p>
          <h1 className="text-2xl font-bold text-shop-fg">Objednávku jsme nenašli</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-shop-muted">
            Odkaz je neplatný nebo vypršel. Potvrzení objednávky jsme vám poslali e-mailem —
            najdete v něm všechny údaje.
          </p>
          <Link href="/"
            className="mt-8 inline-block rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-shop-fg transition hover:border-gold hover:text-gold">
            Zpět do obchodu
          </Link>
        </div>
      </div>
    )
  }

  const [branch, supplier] = await Promise.all([
    prisma.branchSettings.findFirst({
      select: { name: true, street: true, zip: true, city: true, email: true, phone1: true },
    }),
    prisma.supplierSettings.findFirst({ select: { bankAccount: true, iban: true } }),
  ])

  const showBank = isBankTransfer(order.paymentMethod) && !!(supplier?.bankAccount || supplier?.iban)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Poděkování */}
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="mb-4 text-5xl">✅</p>
        <h1 className="text-2xl font-bold text-shop-fg">Děkujeme za vaši objednávku!</h1>
        <p className="mt-2 text-sm text-shop-muted">
          Číslo objednávky: <span className="font-bold text-gold">{order.orderNumber}</span>
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-shop-muted">
          Potvrzení s rekapitulací jsme poslali na <span className="font-medium text-shop-fg">{order.contactEmail}</span>.
        </p>
      </div>

      {/* Platební údaje u převodu */}
      {showBank && (
        <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/5 p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gold">Platební údaje pro převod</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {supplier?.bankAccount && (
              <div className="flex justify-between gap-4">
                <dt className="text-shop-muted">Číslo účtu</dt>
                <dd className="font-bold text-shop-fg">{supplier.bankAccount}</dd>
              </div>
            )}
            {supplier?.iban && (
              <div className="flex justify-between gap-4">
                <dt className="text-shop-muted">IBAN</dt>
                <dd className="font-bold text-shop-fg">{supplier.iban}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-shop-muted">Variabilní symbol</dt>
              <dd className="font-bold text-shop-fg">{order.orderNumber}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-shop-muted">Částka</dt>
              <dd className="font-bold text-gold">{formatCZK(Number(order.totalWithVat))}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-shop-muted">
            Objednávku začneme připravovat po připsání platby na účet.
          </p>
        </div>
      )}

      {/* Rekapitulace */}
      <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-shop-fg">Rekapitulace objednávky</h2>
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
          {order.preferredDeliveryDate && (
            <div className="flex justify-between">
              <dt className="text-shop-muted">Přání k termínu doručení</dt>
              <dd className="text-shop-fg">
                {order.preferredDeliveryDate.toLocaleDateString('cs-CZ')}
                {order.deliveryTimeSlot ? ` (${order.deliveryTimeSlot})` : ''}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.5">
            <dt className="text-base font-bold text-shop-fg">Celkem k úhradě</dt>
            <dd className="text-xl font-bold text-gold">{formatCZK(Number(order.totalWithVat))}</dd>
          </div>
        </dl>
      </div>

      {/* Co bude následovat */}
      <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold text-shop-fg">Co bude následovat</h2>
        <ol className="space-y-2 text-sm text-shop-muted">
          <li>1. Objednávku zkontrolujeme a potvrdíme{showBank ? ' po připsání platby' : ''}.</li>
          <li>2. Zboží pečlivě připravíme{order.preferredDeliveryDate ? ' k vašemu přání na termín doručení' : ''}.</li>
          <li>3. O každé změně stavu vás budeme informovat e-mailem.</li>
        </ol>
        {branch && (
          <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-shop-muted">
            Máte dotaz k objednávce? Ozvěte se nám — {branch.name}, {branch.street}, {branch.zip} {branch.city}
            {branch.phone1 && (
              <>
                , tel.{' '}
                <a href={`tel:${branch.phone1.replace(/\s+/g, '')}`} className="font-medium text-gold hover:underline">
                  {branch.phone1}
                </a>
              </>
            )}
            {branch.email && (
              <>
                , e-mail{' '}
                <a href={`mailto:${branch.email}`} className="font-medium text-gold hover:underline">
                  {branch.email}
                </a>
              </>
            )}
            . U dotazů uvádějte číslo objednávky <span className="font-medium text-shop-fg">{order.orderNumber}</span>.
          </p>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link href="/"
          className="inline-block rounded-xl bg-gold px-6 py-3 text-sm font-bold text-white transition hover:bg-gold/90">
          Zpět do obchodu
        </Link>
      </div>
    </div>
  )
}
