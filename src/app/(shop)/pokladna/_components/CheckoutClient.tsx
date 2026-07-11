'use client'

// Pokladna — jednostránkový checkout. Košík (localStorage) → POST /api/orders
// → přesměrování na /pokladna/dekujeme?t=<token>. Ceny se počítají sdílenou
// funkcí calculateOrderTotals, stejnou jako používá serverové API.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart, cartItemKey } from '../../_context/CartContext'
import { fmtKc } from '../../_components/cart/fmtKc'
import { calculateOrderTotals, formatCZK, itemUnitSuffix } from '@/lib/pricing'
import { UspIcon } from '@/lib/usp-icons'
import {
  calculateCartWeightKg,
  resolveShippingPrice,
  formatWeightKg,
  type ShippingPriceResult,
  type WeightTier,
} from '@/lib/cart-weight'

export type ShippingOption = {
  id: string
  code: string
  name: string
  description: string | null
  isPickup: boolean
  estimatedDays: string | null
  priceWithVat: number
  vatRate: number
  freeShippingThreshold: number | null
  maxOrderValue: number | null
  maxWeightKg: number | null
  /** Země, do kterých metoda doručuje ('CZ' / 'SK') */
  countries: string[]
  usesWeightTiers: boolean
  fuelSurchargePercent: number
  defaultItemWeightGrams: number
  weightTiers: WeightTier[]
  allowedPaymentIds: string[]
}

const COUNTRY_OPTIONS = [
  { code: 'CZ', label: 'Česko' },
  { code: 'SK', label: 'Slovensko' },
] as const

export type PaymentOption = {
  id: string
  code: string
  name: string
  description: string | null
  type: string | null
  /** MANUAL | PAYPAL — online platby přesměrují na bránu */
  provider: string
  feeWithVat: number
  vatRate: number
}

/** Předvyplnění z profilu přihlášeného zákazníka */
export type CheckoutPrefill = {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  city: string
  postalCode: string
  isBusiness: boolean
  companyName: string
  companyId: string
  vatId: string
}

type Props = {
  shippingOptions: ShippingOption[]
  paymentOptions: PaymentOption[]
  termsSlug: string
  /** Benefity (USP) — malá připomínka nad souhrnem objednávky */
  uspItems: Array<{ icon: string; title: string }>
  prefill: CheckoutPrefill | null
  isLoggedIn: boolean
  /** Hláška po návratu z platební brány (zrušená/neúspěšná platba) */
  paymentNotice: string | null
}

// ─── Validace ──────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PSC_RE = /^\d{3}\s?\d{2}$/
const PHONE_RE = /^\+?\d{9,15}$/
const ICO_RE = /^\d{8}$/

type FormValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  city: string
  postalCode: string
  country: string
  isBusiness: boolean
  companyName: string
  companyId: string
  vatId: string
  note: string
  deliveryDate: string
  deliveryTimeSlot: string
}

const EMPTY_FORM: FormValues = {
  firstName: '', lastName: '', email: '', phone: '',
  street: '', city: '', postalCode: '', country: 'CZ',
  isBusiness: false, companyName: '', companyId: '', vatId: '',
  note: '', deliveryDate: '', deliveryTimeSlot: '',
}

function validateField(name: string, values: FormValues): string | null {
  const v = (values[name as keyof FormValues] as string)?.trim?.() ?? ''
  switch (name) {
    case 'firstName': return v ? null : 'Vyplňte prosím jméno.'
    case 'lastName': return v ? null : 'Vyplňte prosím příjmení.'
    case 'email':
      if (!v) return 'Vyplňte prosím e-mail.'
      return EMAIL_RE.test(v) ? null : 'Zadejte platný e-mail (např. jan@email.cz).'
    case 'phone':
      if (!v) return 'Vyplňte prosím telefon.'
      return PHONE_RE.test(v.replace(/[\s-]/g, '')) ? null : 'Zadejte platné telefonní číslo (např. 777 123 456).'
    case 'street': return v ? null : 'Vyplňte prosím ulici a číslo popisné.'
    case 'city': return v ? null : 'Vyplňte prosím město.'
    case 'postalCode':
      if (!v) return 'Vyplňte prosím PSČ.'
      return PSC_RE.test(v) ? null : 'Zadejte platné PSČ (např. 140 00).'
    case 'companyName':
      return !values.isBusiness || v ? null : 'Vyplňte prosím název firmy.'
    case 'companyId':
      if (!values.isBusiness) return null
      if (!v) return 'Vyplňte prosím IČO.'
      return ICO_RE.test(v) ? null : 'IČO má přesně 8 číslic.'
    default: return null
  }
}

const VALIDATED_FIELDS = [
  'firstName', 'lastName', 'email', 'phone',
  'street', 'city', 'postalCode', 'companyName', 'companyId',
] as const

// ─── UI pomocníci ──────────────────────────────────────────────────

function Field({
  id, label, error, required, children,
}: {
  id: string
  label: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-shop-fg">
        {label} {required && <span className="text-gold">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-shop-fg outline-none transition placeholder:text-shop-muted/60 focus:border-gold focus:ring-2 focus:ring-gold/20 ${
    hasError ? 'border-red-300' : 'border-stone-300'
  }`
}

/** ⓘ u Cool Balíku — vysvětluje výpočet ceny z váhy a pásma. */
function ShippingInfoPopover({
  weightKg,
  price,
  fuelSurchargePercent,
  freeShippingThreshold,
}: {
  weightKg: number
  price: ShippingPriceResult
  fuelSurchargePercent: number
  freeShippingThreshold: number | null
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Jak se počítá cena dopravy"
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }}
        className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-stone-300 text-[10px] font-bold text-shop-muted transition hover:border-gold hover:text-gold"
        style={{ height: 18, width: 18 }}
      >
        i
      </button>
      {open && (
        <span className="absolute left-0 top-full z-40 mt-1.5 block w-72 rounded-xl border border-stone-200 bg-white p-3.5 text-xs font-normal shadow-xl">
          <span className="block text-shop-fg">
            Váha objednávky: <strong>{formatWeightKg(weightKg)}</strong>
            {price.tier && (
              <> → pásmo do {price.tier.maxWeightKg} kg: <strong>{fmtKc(price.tier.priceWithVat)}</strong></>
            )}
          </span>
          {price.surchargeWithVat > 0 && (
            <span className="mt-1 block text-shop-muted">
              + palivový příplatek {fuelSurchargePercent.toLocaleString('cs-CZ')} %: {fmtKc(price.surchargeWithVat)}
            </span>
          )}
          {freeShippingThreshold && (
            <span className="mt-1 block text-gold">
              {price.isFree
                ? `Máte dopravu zdarma (nákup nad ${fmtKc(freeShippingThreshold)}).`
                : `Doprava zdarma při nákupu nad ${fmtKc(freeShippingThreshold)} — chybí vám ještě ${fmtKc(price.amountToFreeShipping)}.`}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

function SectionCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold text-shop-fg">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// ─── Hlavní komponenta ─────────────────────────────────────────────

export function CheckoutClient({ shippingOptions, paymentOptions, termsSlug, uspItems, prefill, isLoggedIn, paymentNotice }: Props) {
  const router = useRouter()
  const { items, hydrated, clear, openCart } = useCart()

  const [values, setValues] = useState<FormValues>(() =>
    prefill ? { ...EMPTY_FORM, ...prefill } : EMPTY_FORM,
  )
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [shippingId, setShippingId] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // po úspěšném odeslání košík vyprázdníme — nesmí nás to poslat na homepage
  const submittedRef = useRef(false)

  // Stejný výpočet jako serverové API (nezaokrouhlený mezisoučet pro limity)
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceWithVat, 0)

  // Odhad hmotnosti košíku — stejná sdílená funkce jako na serveru
  const cartWeightKg = useMemo(
    () =>
      calculateCartWeightKg(
        items.map((i) => ({
          quantity: i.qty,
          isWeightBased: i.isWeightBased,
          isVariant: !!i.variantId,
          unit: i.unit,
          weightGrams: i.weightGrams,
        })),
      ),
    [items],
  )

  // Prázdný košík → homepage s hláškou (až po hydrataci z localStorage)
  useEffect(() => {
    if (hydrated && items.length === 0 && !submittedRef.current) {
      router.replace('/?kosik=prazdny')
    }
  }, [hydrated, items.length, router])

  // Cena a váha PER METODA (metody mohou mít různou výchozí hmotnost položky)
  // — stejná sdílená funkce resolveShippingPrice jako na serveru
  const shippingComputed = useMemo(() => {
    const map = new Map<string, { weightKg: number; price: ShippingPriceResult }>()
    for (const s of shippingOptions) {
      const weightKg = calculateCartWeightKg(
        items.map((i) => ({
          quantity: i.qty,
          isWeightBased: i.isWeightBased,
          isVariant: !!i.variantId,
          unit: i.unit,
          weightGrams: i.weightGrams,
        })),
        s.defaultItemWeightGrams,
      )
      map.set(s.id, { weightKg, price: resolveShippingPrice(s, weightKg, subtotal) })
    }
    return map
  }, [shippingOptions, items, subtotal])

  // Dopravy pro zvolenou ZEMI, vyhovující hodnotě i hmotnosti objednávky
  const availableShipping = useMemo(
    () =>
      shippingOptions.filter(
        (s) =>
          s.countries.includes(values.country) &&
          (!s.maxOrderValue || s.maxOrderValue >= subtotal) &&
          (!s.maxWeightKg || s.maxWeightKg >= (shippingComputed.get(s.id)?.weightKg ?? 0)) &&
          shippingComputed.get(s.id)?.price.priceWithVat !== null,
      ),
    [shippingOptions, subtotal, values.country, shippingComputed],
  )

  const selectedShipping = availableShipping.find((s) => s.id === shippingId) ?? null

  // Změna země/košíku může zneplatnit zvolenou dopravu
  useEffect(() => {
    if (shippingId && !availableShipping.some((s) => s.id === shippingId)) {
      setShippingId(null)
    }
  }, [availableShipping, shippingId])

  // Platby povolené pro zvolenou dopravu (bez vazeb = všechny ruční platby)
  const availablePayments = useMemo(() => {
    if (!selectedShipping) return paymentOptions
    if (selectedShipping.allowedPaymentIds.length === 0) return paymentOptions
    return paymentOptions.filter((p) => selectedShipping.allowedPaymentIds.includes(p.id))
  }, [selectedShipping, paymentOptions])

  const selectedPayment = availablePayments.find((p) => p.id === paymentId) ?? null

  // Změna dopravy může zneplatnit zvolenou platbu
  useEffect(() => {
    if (paymentId && !availablePayments.some((p) => p.id === paymentId)) {
      setPaymentId(null)
    }
  }, [availablePayments, paymentId])

  // Cena zvolené dopravy (pásmo → příplatek → zdarma) — z per-metoda výpočtu
  const selectedComputed = selectedShipping ? shippingComputed.get(selectedShipping.id) : null
  const shippingPrice = selectedComputed?.price.priceWithVat ?? 0

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        lines: items.map((i) => ({
          quantity: i.qty,
          unitPriceWithVat: i.unitPriceWithVat,
          vatRate: i.vatRate,
        })),
        shippingPriceWithVat: shippingPrice,
        shippingVatRate: selectedShipping?.vatRate,
        paymentFeeWithVat: selectedPayment?.feeWithVat ?? 0,
        paymentFeeVatRate: selectedPayment?.vatRate,
      }),
    [items, shippingPrice, selectedShipping?.vatRate, selectedPayment?.feeWithVat, selectedPayment?.vatRate],
  )

  const set = (name: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setValues((prev) => ({ ...prev, [name]: value }))
    // živé odmazání chyby, jakmile je pole opravené
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, { ...values, [name]: value } as FormValues) }))
    }
  }

  const onBlur = (name: string) => () => {
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values) }))
  }

  // Povinná pole vyplněná + souhlas → aktivace tlačítka (formáty se hlídají při odeslání)
  const requiredFilled =
    values.firstName.trim() && values.lastName.trim() && values.email.trim() &&
    values.phone.trim() && values.street.trim() && values.city.trim() &&
    values.postalCode.trim() &&
    (!values.isBusiness || (values.companyName.trim() && values.companyId.trim()))
  const canSubmit = !!requiredFilled && !!shippingId && !!paymentId && agree && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const nextErrors: Record<string, string | null> = {}
    for (const f of VALIDATED_FIELDS) nextErrors[f] = validateField(f, values)
    setErrors(nextErrors)

    const firstError = VALIDATED_FIELDS.find((f) => nextErrors[f])
    if (firstError) {
      document.getElementById(`f-${firstError}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!shippingId || !paymentId) {
      setSubmitError('Vyberte prosím způsob dopravy a platby.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEmail: values.email.trim(),
          contactPhone: values.phone.replace(/[\s-]/g, ''),
          contactFirstName: values.firstName.trim(),
          contactLastName: values.lastName.trim(),
          isBusinessOrder: values.isBusiness,
          companyName: values.isBusiness ? values.companyName.trim() : undefined,
          companyId: values.isBusiness ? values.companyId.trim() : undefined,
          vatId: values.isBusiness && values.vatId.trim() ? values.vatId.trim() : undefined,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? undefined,
            quantity: i.qty,
          })),
          shippingAddress: {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            street: values.street.trim(),
            city: values.city.trim(),
            postalCode: values.postalCode.trim(),
            country: values.country,
            phone: values.phone.replace(/[\s-]/g, ''),
          },
          billingAddressSameAsShipping: true,
          shippingMethodId: shippingId,
          paymentMethodId: paymentId,
          preferredDeliveryDate: values.deliveryDate
            ? `${values.deliveryDate}T12:00:00.000Z`
            : undefined,
          deliveryTimeSlot: values.deliveryTimeSlot || undefined,
          customerNote: values.note.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setSubmitError(
          body?.error ?? 'Objednávku se nepodařilo odeslat. Zkuste to prosím znovu, vyplněné údaje zůstávají.',
        )
        return
      }

      const order = await res.json()

      // Online platba (PayPal): košík se NEvyprazdňuje — vyprázdní se až
      // po úspěšné platbě na děkovné stránce. Redirect na bránu.
      if (order.approvalUrl) {
        submittedRef.current = true
        window.location.assign(order.approvalUrl)
        return
      }

      submittedRef.current = true
      clear()
      router.replace(`/pokladna/dekujeme?t=${order.publicToken}`)
    } catch {
      setSubmitError('Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu — vyplněné údaje zůstávají.')
    } finally {
      setSubmitting(false)
    }
  }

  // Než se košík načte (nebo když je prázdný a čeká se na redirect), neblikat formulářem
  if (!hydrated || items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center text-sm text-shop-muted">
        Načítám pokladnu…
      </div>
    )
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-shop-fg">Pokladna</h1>

      {paymentNotice && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {paymentNotice}
        </div>
      )}

      {!isLoggedIn && (
        <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-shop-muted">
          Máte účet?{' '}
          <Link href={`/ucet/prihlaseni?from=${encodeURIComponent('/pokladna')}`} className="font-medium text-gold hover:underline">
            Přihlaste se
          </Link>{' '}
          — údaje se předvyplní a objednávku uvidíte v historii. Nakoupit ale můžete i bez účtu.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        {/* ── Levý sloupec: formulář ── */}
        <div className="space-y-5">
          <SectionCard step={1} title="Kontaktní údaje">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="f-firstName" label="Jméno" required error={errors.firstName}>
                <input id="f-firstName" autoComplete="given-name" className={inputCls(!!errors.firstName)}
                  value={values.firstName} onChange={set('firstName')} onBlur={onBlur('firstName')} />
              </Field>
              <Field id="f-lastName" label="Příjmení" required error={errors.lastName}>
                <input id="f-lastName" autoComplete="family-name" className={inputCls(!!errors.lastName)}
                  value={values.lastName} onChange={set('lastName')} onBlur={onBlur('lastName')} />
              </Field>
              <Field id="f-email" label="E-mail" required error={errors.email}>
                <input id="f-email" type="email" autoComplete="email" placeholder="jan@email.cz" className={inputCls(!!errors.email)}
                  value={values.email} onChange={set('email')} onBlur={onBlur('email')} />
              </Field>
              <Field id="f-phone" label="Telefon" required error={errors.phone}>
                <input id="f-phone" type="tel" autoComplete="tel" placeholder="777 123 456" className={inputCls(!!errors.phone)}
                  value={values.phone} onChange={set('phone')} onBlur={onBlur('phone')} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard step={2} title={selectedShipping?.isPickup ? 'Fakturační adresa' : 'Dodací adresa'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id="f-street" label="Ulice a číslo popisné" required error={errors.street}>
                  <input id="f-street" autoComplete="street-address" placeholder="Branická 75/123" className={inputCls(!!errors.street)}
                    value={values.street} onChange={set('street')} onBlur={onBlur('street')} />
                </Field>
              </div>
              <Field id="f-city" label="Město" required error={errors.city}>
                <input id="f-city" autoComplete="address-level2" placeholder="Praha" className={inputCls(!!errors.city)}
                  value={values.city} onChange={set('city')} onBlur={onBlur('city')} />
              </Field>
              <Field id="f-postalCode" label="PSČ" required error={errors.postalCode}>
                <input id="f-postalCode" autoComplete="postal-code" placeholder="140 00" inputMode="numeric" className={inputCls(!!errors.postalCode)}
                  value={values.postalCode} onChange={set('postalCode')} onBlur={onBlur('postalCode')} />
              </Field>
              <Field id="f-country" label="Země doručení" required>
                <select id="f-country" autoComplete="country" className={inputCls(false)}
                  value={values.country} onChange={set('country')}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-shop-fg">
              <input type="checkbox" checked={values.isBusiness} onChange={set('isBusiness')}
                className="h-4 w-4 rounded border-stone-300 accent-[#C9A961]" />
              Firemní nákup (nakupuji na firmu)
            </label>

            {values.isBusiness && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field id="f-companyName" label="Název firmy" required error={errors.companyName}>
                    <input id="f-companyName" autoComplete="organization" className={inputCls(!!errors.companyName)}
                      value={values.companyName} onChange={set('companyName')} onBlur={onBlur('companyName')} />
                  </Field>
                </div>
                <Field id="f-companyId" label="IČO" required error={errors.companyId}>
                  <input id="f-companyId" inputMode="numeric" placeholder="12345678" className={inputCls(!!errors.companyId)}
                    value={values.companyId} onChange={set('companyId')} onBlur={onBlur('companyId')} />
                </Field>
                <Field id="f-vatId" label="DIČ (nepovinné)">
                  <input id="f-vatId" placeholder="CZ12345678" className={inputCls(false)}
                    value={values.vatId} onChange={set('vatId')} />
                </Field>
              </div>
            )}
          </SectionCard>

          <SectionCard step={3} title="Doprava">
            {availableShipping.length === 0 ? (
              <p className="text-sm text-shop-muted">Pro tuto objednávku není dostupná žádná doprava. Kontaktujte nás prosím telefonicky.</p>
            ) : (
              <div className="space-y-2.5">
                {availableShipping.map((s) => {
                  const computed = shippingComputed.get(s.id)!
                  const price = computed.price
                  const displayPrice = price.priceWithVat ?? 0
                  const active = shippingId === s.id
                  return (
                    <label key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${active ? 'border-gold bg-gold/5 ring-1 ring-gold' : 'border-stone-200 hover:border-gold/50'}`}>
                      <input type="radio" name="shipping" checked={active} onChange={() => setShippingId(s.id)}
                        className="h-4 w-4 accent-[#C9A961]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-shop-fg">
                          {s.name}
                          {s.usesWeightTiers && (
                            <ShippingInfoPopover
                              weightKg={computed.weightKg}
                              price={price}
                              fuelSurchargePercent={s.fuelSurchargePercent}
                              freeShippingThreshold={s.freeShippingThreshold}
                            />
                          )}
                        </span>
                        {s.description && <span className="block text-xs text-shop-muted">{s.description}</span>}
                        {s.estimatedDays && <span className="block text-xs text-shop-muted">Doručení: {s.estimatedDays}</span>}
                        {price.amountToFreeShipping > 0 && s.freeShippingThreshold && (
                          <span className="block text-xs text-gold">
                            Doprava zdarma při nákupu nad {fmtKc(s.freeShippingThreshold)} — chybí vám ještě {fmtKc(price.amountToFreeShipping)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-shop-fg">
                        {displayPrice === 0 ? <span className="text-green-700">Zdarma</span> : fmtKc(displayPrice)}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard step={4} title="Platba">
            {!selectedShipping ? (
              <p className="text-sm text-shop-muted">Nejdříve vyberte způsob dopravy.</p>
            ) : (
              <div className="space-y-2.5">
                {availablePayments.map((p) => {
                  const active = paymentId === p.id
                  return (
                    <label key={p.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${active ? 'border-gold bg-gold/5 ring-1 ring-gold' : 'border-stone-200 hover:border-gold/50'}`}>
                      <input type="radio" name="payment" checked={active} onChange={() => setPaymentId(p.id)}
                        className="h-4 w-4 accent-[#C9A961]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-shop-fg">{p.name}</span>
                        {p.description && <span className="block text-xs text-shop-muted">{p.description}</span>}
                        {p.provider === 'PAYPAL' && (
                          <span className="block text-xs text-gold">Po odeslání objednávky vás přesměrujeme na PayPal.</span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-shop-fg">
                        {p.feeWithVat > 0 ? `+ ${fmtKc(p.feeWithVat)}` : 'Zdarma'}
                      </span>
                    </label>
                  )
                })}
                <p className="pt-1 text-xs text-shop-muted">Platbu kartou online připravujeme.</p>
              </div>
            )}
          </SectionCard>

          <SectionCard step={5} title="Termín a poznámka">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="f-deliveryDate" label="Přání k termínu doručení (nepovinné)">
                <input id="f-deliveryDate" type="date" min={tomorrow} className={inputCls(false)}
                  value={values.deliveryDate} onChange={set('deliveryDate')} />
              </Field>
              <Field id="f-deliveryTimeSlot" label="Čas doručení (nepovinné)">
                <select id="f-deliveryTimeSlot" className={inputCls(false)}
                  value={values.deliveryTimeSlot} onChange={set('deliveryTimeSlot')} disabled={!values.deliveryDate}>
                  <option value="">Kdykoli během dne</option>
                  <option value="9–12">Dopoledne (9–12)</option>
                  <option value="12–18">Odpoledne (12–18)</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field id="f-note" label="Poznámka k objednávce (nepovinné)">
                  <textarea id="f-note" rows={3} className={inputCls(false)}
                    placeholder="Např. zazvonit dvakrát, vchod ze dvora…"
                    value={values.note} onChange={set('note')} />
                </Field>
              </div>
            </div>
            <p className="mt-3 text-xs text-shop-muted">
              Termín doručení je přání — potvrdíme ho podle dostupnosti při zpracování objednávky.
            </p>
          </SectionCard>
        </div>

        {/* ── Pravý sloupec: souhrn ── */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          {uspItems.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-2xl bg-shop-surface px-4 py-3">
              {uspItems.map((u) => (
                <li key={u.title} className="flex items-center gap-1.5 text-xs font-medium text-shop-fg">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                    <UspIcon name={u.icon} className="h-3 w-3" />
                  </span>
                  {u.title}
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-shop-fg">Vaše objednávka</h2>
              <button type="button" onClick={() => openCart()}
                className="text-xs font-medium text-gold hover:underline">
                Upravit košík
              </button>
            </div>

            <ul className="divide-y divide-stone-100">
              {items.map((i) => (
                <li key={cartItemKey(i)} className="flex items-center gap-3 py-2.5">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {i.thumbnailUrl && (
                      <Image src={i.thumbnailUrl} alt={i.name} fill className="object-contain p-0.5" sizes="40px" unoptimized />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-shop-fg">{i.name}</p>
                    {i.variantName && <p className="text-xs text-gold">{i.variantName}</p>}
                    <p className="text-xs text-shop-muted">
                      {i.qty} × {fmtKc(i.unitPriceWithVat)} {itemUnitSuffix(i)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-shop-fg">{fmtKc(i.qty * i.unitPriceWithVat)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1.5 border-t border-stone-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-shop-muted">Mezisoučet</dt>
                <dd className="text-shop-fg">{formatCZK(totals.subtotalWithVat)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-shop-muted">Doprava{selectedShipping ? ` – ${selectedShipping.name}` : ''}</dt>
                <dd className="text-shop-fg">
                  {selectedShipping ? (shippingPrice === 0 ? 'Zdarma' : formatCZK(totals.shippingWithVat)) : '—'}
                </dd>
              </div>
              {totals.paymentFeeWithVat > 0 && (
                <div className="flex justify-between">
                  <dt className="text-shop-muted">Platba{selectedPayment ? ` – ${selectedPayment.name}` : ''}</dt>
                  <dd className="text-shop-fg">{formatCZK(totals.paymentFeeWithVat)}</dd>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <dt className="text-shop-muted">Hmotnost (odhad)</dt>
                <dd className="text-shop-muted">{formatWeightKg(selectedComputed?.weightKg ?? cartWeightKg)}</dd>
              </div>
              {Object.entries(totals.vatBreakdown).map(([rate, v]) => (
                <div key={rate} className="flex justify-between text-xs">
                  <dt className="text-shop-muted">z toho DPH {rate} %</dt>
                  <dd className="text-shop-muted">{formatCZK(v.vat)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.5">
                <dt className="text-base font-bold text-shop-fg">Celkem k úhradě</dt>
                <dd className="text-xl font-bold text-gold">{formatCZK(totals.totalWithVat)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-shop-fg">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-[#C9A961]" />
              <span>
                Souhlasím s{' '}
                <Link href={`/${termsSlug}`} target="_blank" className="font-medium text-gold hover:underline">
                  obchodními podmínkami
                </Link>{' '}
                <span className="text-gold">*</span>
              </span>
            </label>

            {submitError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {submitError}
              </p>
            )}

            <button type="submit" disabled={!canSubmit}
              className="mt-4 w-full rounded-xl bg-gold px-4 py-3.5 text-center text-sm font-bold text-white transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40">
              {submitting ? 'Odesílám objednávku…' : `Odeslat objednávku za ${formatCZK(totals.totalWithVat)}`}
            </button>
            <p className="mt-2.5 text-center text-xs text-shop-muted">
              Odesláním vzniká závazná objednávka s povinností platby.
            </p>
          </div>
        </aside>
      </form>
    </div>
  )
}
