'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  computeCustomerRating,
  ratingEmoji,
  ratingColorClass,
} from '@/lib/customer-rating'
import {
  updateCustomer,
  deleteCustomer,
  deleteCustomerAddress,
  type UpdateCustomerData,
} from './actions'
import { AccountTab, type SerializedAccount } from './AccountTab'

// ── Exportované typy (používá page.tsx) ───────────────────────────

export type SerializedAddress = {
  id: string
  firstName: string
  lastName: string
  street: string
  city: string
  postalCode: string
  country: string
}

export type SerializedOrderStats = {
  totalCount: number
  completedCount: number
  completedTotal: number
  cancelledCount: number
  cancelledTotal: number
  lastOrderAt: string | null
}

export type SerializedCustomerDetail = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  shoptetId: string | null
  hasPassword: boolean
  hasGoogle: boolean
  isBusinessCustomer: boolean
  companyName: string | null
  companyId: string | null
  vatId: string | null
  internalNote: string | null
  createdAt: string
  updatedAt: string
  addressCount: number
  billingAddress: SerializedAddress | null
  shippingAddress: SerializedAddress | null
  orderStats: SerializedOrderStats
  orderStatuses: string[]
  account: SerializedAccount
}

// ── FormState ─────────────────────────────────────────────────────

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  internalNote: string
  isBusinessCustomer: boolean
  companyName: string
  companyId: string
  vatId: string
  billingId: string | null
  billingFirstName: string
  billingLastName: string
  billingStreet: string
  billingCity: string
  billingPostalCode: string
  billingCountry: string
  shippingId: string | null
  shippingFirstName: string
  shippingLastName: string
  shippingStreet: string
  shippingCity: string
  shippingPostalCode: string
  shippingCountry: string
}

function buildInitialState(c: SerializedCustomerDetail): FormState {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone ?? '',
    internalNote: c.internalNote ?? '',
    isBusinessCustomer: c.isBusinessCustomer,
    companyName: c.companyName ?? '',
    companyId: c.companyId ?? '',
    vatId: c.vatId ?? '',
    billingId: c.billingAddress?.id ?? null,
    billingFirstName: c.billingAddress?.firstName ?? '',
    billingLastName: c.billingAddress?.lastName ?? '',
    billingStreet: c.billingAddress?.street ?? '',
    billingCity: c.billingAddress?.city ?? '',
    billingPostalCode: c.billingAddress?.postalCode ?? '',
    billingCountry: c.billingAddress?.country ?? 'Česká republika',
    shippingId: c.shippingAddress?.id ?? null,
    shippingFirstName: c.shippingAddress?.firstName ?? '',
    shippingLastName: c.shippingAddress?.lastName ?? '',
    shippingStreet: c.shippingAddress?.street ?? '',
    shippingCity: c.shippingAddress?.city ?? '',
    shippingPostalCode: c.shippingAddress?.postalCode ?? '',
    shippingCountry: c.shippingAddress?.country ?? 'Česká republika',
  }
}

// ── Konstanty ─────────────────────────────────────────────────────

const COUNTRIES = ['Česká republika', 'Slovensko', 'Německo', 'Rakousko', 'Polsko']

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function fmtCZK(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtLastOrder(iso: string | null): string {
  if (!iso) return 'Nikdy'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'dnes'
  if (d === 1) return 'včera'
  return `před ${d} dny`
}

function inputCls(hasError?: boolean) {
  return `w-full rounded border px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${
    hasError ? 'border-red-400' : 'border-stone-300'
  }`
}

// ── Modul-level komponenty (NE uvnitř CustomerDetailClient!) ──────

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 border-b border-stone-100 pb-2 text-sm font-semibold text-stone-700">
      {children}
    </h3>
  )
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-stone-200">
      <div className="text-center text-stone-400">
        <p className="font-medium">Brzy k dispozici</p>
        <p className="mt-1 text-xs">{label}</p>
      </div>
    </div>
  )
}

function CountrySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const options = COUNTRIES.includes(value) ? COUNTRIES : [value, ...COUNTRIES]
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls()}>
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

interface Props {
  customer: SerializedCustomerDetail
  userRole: string
}

export function CustomerDetailClient({ customer, userRole }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState('hlavni')
  const [b2bOpen, setB2bOpen] = useState(customer.isBusinessCustomer)
  const [shippingOpen, setShippingOpen] = useState(!!customer.shippingAddress)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formState, setFormState] = useState<FormState>(() => buildInitialState(customer))
  const [savedState, setSavedState] = useState<FormState>(() => buildInitialState(customer))

  // Reset po uložení nebo změně adres
  useEffect(() => {
    const s = buildInitialState(customer)
    setFormState(s)
    setSavedState(s)
    setB2bOpen(customer.isBusinessCustomer)
    setShippingOpen(!!customer.shippingAddress)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.updatedAt, customer.billingAddress?.id, customer.shippingAddress?.id])

  const isDirty = JSON.stringify(formState) !== JSON.stringify(savedState)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Rating
  const rating = computeCustomerRating(customer.orderStatuses)
  const { completedCount, cancelledCount, totalCount } = customer.orderStats
  const ratingText = !rating
    ? 'Nový zákazník (zatím žádné objednávky)'
    : rating === 'good'
    ? `Spolehlivý zákazník (${completedCount} objednávek, 0 storno)`
    : rating === 'bad'
    ? `Problémový zákazník (${cancelledCount} z ${totalCount} storno)`
    : totalCount < 3
    ? 'Nový zákazník'
    : 'Průměrný zákazník'

  // ── Setters ────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  // ── Validace ───────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!formState.firstName.trim()) e.firstName = 'Křestní jméno je povinné.'
    if (!formState.lastName.trim()) e.lastName = 'Příjmení je povinné.'
    if (!formState.email.trim()) e.email = 'E-mail je povinný.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email))
      e.email = 'Neplatný formát e-mailu.'
    if (formState.isBusinessCustomer && !formState.companyName.trim())
      e.companyName = 'Název společnosti je povinný.'
    if (formState.isBusinessCustomer && formState.companyId && !/^\d{8}$/.test(formState.companyId))
      e.companyId = 'IČO musí obsahovat přesně 8 číslic.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Build update data ──────────────────────────────────────────

  function buildUpdateData(): UpdateCustomerData {
    return {
      firstName: formState.firstName,
      lastName: formState.lastName,
      email: formState.email,
      phone: formState.phone || null,
      internalNote: formState.internalNote || null,
      isBusinessCustomer: formState.isBusinessCustomer,
      companyName: formState.isBusinessCustomer ? formState.companyName || null : null,
      companyId: formState.isBusinessCustomer ? formState.companyId || null : null,
      vatId: formState.isBusinessCustomer ? formState.vatId || null : null,
      billing: formState.billingId
        ? {
            id: formState.billingId,
            firstName: formState.billingFirstName,
            lastName: formState.billingLastName,
            street: formState.billingStreet,
            city: formState.billingCity,
            postalCode: formState.billingPostalCode,
            country: formState.billingCountry,
          }
        : null,
      shipping: formState.shippingId
        ? {
            id: formState.shippingId,
            firstName: formState.shippingFirstName,
            lastName: formState.shippingLastName,
            street: formState.shippingStreet,
            city: formState.shippingCity,
            postalCode: formState.shippingPostalCode,
            country: formState.shippingCountry,
          }
        : null,
    }
  }

  // ── Handlery ───────────────────────────────────────────────────

  function handleSave(redirectAfter = false) {
    if (!validate()) {
      toast.error('Opravte chyby ve formuláři.')
      return
    }
    startTransition(async () => {
      try {
        await updateCustomer(customer.id, buildUpdateData())
        toast.success('Zákazník uložen')
        if (redirectAfter) router.push('/admin/zakaznici')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  function handleDelete() {
    const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.email
    if (!window.confirm(`Opravdu smazat zákazníka „${name}"?\n\nTato akce je nevratná.`)) return
    startTransition(async () => {
      try {
        await deleteCustomer(customer.id)
        router.push('/admin/zakaznici')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při mazání')
      }
    })
  }

  function handleDeleteAddress(addressId: string) {
    if (!window.confirm('Smazat tuto adresu?')) return
    startTransition(async () => {
      try {
        await deleteCustomerAddress(addressId)
        toast.success('Adresa smazána')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při mazání adresy')
      }
    })
  }

  function handleBack() {
    if (isDirty && !window.confirm('Máte neuložené změny. Opravdu chcete odejít?')) return
    router.push('/admin/zakaznici')
  }

  // ── Render: záložka Hlavní údaje ───────────────────────────────
  // Pozor: voláme jako funkci tabHlavni(), NE jako <TabHlavni /> —
  // vnořená JSX funkce volaná jako komponenta by způsobila remount
  // při každém setState a vstupy by ztrácely focus.

  function tabHlavni() {
    return (
      <div className="space-y-8">

        {/* Sekce 1: Základní informace */}
        <div>
          <SectionTitle>Základní informace</SectionTitle>
          <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-stone-50">
            {([
              { label: 'Registrován', value: fmtDate(customer.createdAt) },
              {
                label: 'Nakoupil',
                value: completedCount > 0
                  ? `${completedCount}× za celkem ${fmtCZK(customer.orderStats.completedTotal)}`
                  : '—',
              },
              {
                label: 'Stornováno',
                value: cancelledCount > 0
                  ? `${cancelledCount}× za celkem ${fmtCZK(customer.orderStats.cancelledTotal)}`
                  : '—',
              },
              { label: 'Poslední nákup', value: fmtLastOrder(customer.orderStats.lastOrderAt) },
            ] as const).map(({ label, value }) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <dt className="text-stone-500">{label}</dt>
                <dd className="font-medium text-stone-800">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Sekce 2: Kontaktní údaje */}
        <div>
          <SectionTitle>Kontaktní údaje</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Křestní jméno" error={errors.firstName}>
              <input
                type="text"
                value={formState.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                className={inputCls(!!errors.firstName)}
              />
            </Field>
            <Field label="Příjmení" error={errors.lastName}>
              <input
                type="text"
                value={formState.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                className={inputCls(!!errors.lastName)}
              />
            </Field>
            <Field label="E-mail" error={errors.email}>
              <input
                type="email"
                value={formState.email}
                onChange={(e) => setField('email', e.target.value)}
                className={inputCls(!!errors.email)}
              />
            </Field>
            <Field label="Telefon">
              <input
                type="text"
                value={formState.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+420"
                className={inputCls()}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-stone-700">Heslo</p>
              <p className="text-xs text-stone-400">
                {customer.hasPassword ? 'Heslo nastaveno' : 'Importováno bez hesla'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('ucty')}
              className="rounded border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:bg-stone-100"
            >
              Spravovat účet →
            </button>
          </div>
        </div>

        {/* Sekce 3: Hodnocení */}
        <div>
          <SectionTitle>Hodnocení zákazníka</SectionTitle>
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            {rating ? (
              <>
                <span className={`text-2xl ${ratingColorClass(rating)}`}>{ratingEmoji(rating)}</span>
                <span className="text-sm text-stone-700">{ratingText}</span>
              </>
            ) : (
              <>
                <span className="text-2xl text-stone-300">😐</span>
                <span className="text-sm text-stone-500">{ratingText}</span>
              </>
            )}
          </div>

          <Field
            label={
              <span className="flex items-center gap-1.5">
                Interní poznámka
                <span
                  title="Tyto poznámky vidí jen administrátoři"
                  className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-500"
                >
                  i
                </span>
              </span>
            }
          >
            <textarea
              value={formState.internalNote}
              onChange={(e) => setField('internalNote', e.target.value)}
              rows={3}
              placeholder="Alergie, preference, speciální přání..."
              className={inputCls()}
            />
          </Field>
        </div>

        {/* Sekce 4: Fakturační adresa */}
        <div>
          <SectionTitle>Fakturační adresa</SectionTitle>
          {formState.billingId ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Jméno">
                  <input
                    type="text"
                    value={formState.billingFirstName}
                    onChange={(e) => setField('billingFirstName', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="Příjmení">
                  <input
                    type="text"
                    value={formState.billingLastName}
                    onChange={(e) => setField('billingLastName', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="Ulice">
                  <input
                    type="text"
                    value={formState.billingStreet}
                    onChange={(e) => setField('billingStreet', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="Město">
                  <input
                    type="text"
                    value={formState.billingCity}
                    onChange={(e) => setField('billingCity', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="PSČ">
                  <input
                    type="text"
                    value={formState.billingPostalCode}
                    onChange={(e) => setField('billingPostalCode', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="Země">
                  <CountrySelect
                    value={formState.billingCountry}
                    onChange={(v) => setField('billingCountry', v)}
                  />
                </Field>
              </div>
              {customer.addressCount > 1 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(formState.billingId!)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:underline disabled:opacity-40"
                  >
                    Smazat adresu
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-400">
              <span>Žádná fakturační adresa</span>
              <button
                type="button"
                onClick={() => toast.info('Přidávání adres brzy k dispozici')}
                className="rounded border border-stone-300 px-3 py-1 text-xs text-stone-500 hover:bg-stone-50"
              >
                + Přidat
              </button>
            </div>
          )}
        </div>

        {/* Sekce 5: B2B (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setB2bOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-4 py-3 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            <span>Informace o společnosti (B2B)</span>
            <span className="text-stone-400">{b2bOpen ? '▲' : '▼'}</span>
          </button>

          {b2bOpen && (
            <div className="mt-3 space-y-4 rounded-lg border border-stone-200 p-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formState.isBusinessCustomer}
                  onChange={(e) => setField('isBusinessCustomer', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-stone-700">
                  Velkoobchodní zákazník (B2B)
                </span>
              </label>

              {formState.isBusinessCustomer && (
                <div className="space-y-4">
                  <Field label="Název společnosti" error={errors.companyName}>
                    <input
                      type="text"
                      value={formState.companyName}
                      onChange={(e) => setField('companyName', e.target.value)}
                      className={inputCls(!!errors.companyName)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="IČO" error={errors.companyId} hint="8 číslic">
                      <input
                        type="text"
                        value={formState.companyId}
                        onChange={(e) => setField('companyId', e.target.value)}
                        maxLength={8}
                        className={inputCls(!!errors.companyId)}
                      />
                    </Field>
                    <Field label="DIČ" hint="Např. CZ12345678">
                      <input
                        type="text"
                        value={formState.vatId}
                        onChange={(e) => setField('vatId', e.target.value)}
                        className={inputCls()}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sekce 6: Doručovací adresa (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShippingOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-4 py-3 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            <span>Doručovací adresa</span>
            <span className="text-stone-400">{shippingOpen ? '▲' : '▼'}</span>
          </button>

          {shippingOpen && (
            <div className="mt-3 rounded-lg border border-stone-200 p-4">
              {formState.shippingId ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Jméno">
                      <input
                        type="text"
                        value={formState.shippingFirstName}
                        onChange={(e) => setField('shippingFirstName', e.target.value)}
                        className={inputCls()}
                      />
                    </Field>
                    <Field label="Příjmení">
                      <input
                        type="text"
                        value={formState.shippingLastName}
                        onChange={(e) => setField('shippingLastName', e.target.value)}
                        className={inputCls()}
                      />
                    </Field>
                    <Field label="Ulice">
                      <input
                        type="text"
                        value={formState.shippingStreet}
                        onChange={(e) => setField('shippingStreet', e.target.value)}
                        className={inputCls()}
                      />
                    </Field>
                    <Field label="Město">
                      <input
                        type="text"
                        value={formState.shippingCity}
                        onChange={(e) => setField('shippingCity', e.target.value)}
                        className={inputCls()}
                      />
                    </Field>
                    <Field label="PSČ">
                      <input
                        type="text"
                        value={formState.shippingPostalCode}
                        onChange={(e) => setField('shippingPostalCode', e.target.value)}
                        className={inputCls()}
                      />
                    </Field>
                    <Field label="Země">
                      <CountrySelect
                        value={formState.shippingCountry}
                        onChange={(v) => setField('shippingCountry', v)}
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(formState.shippingId!)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:underline disabled:opacity-40"
                    >
                      Smazat adresu
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm text-stone-400">
                  <span>Žádná doručovací adresa</span>
                  <button
                    type="button"
                    onClick={() => toast.info('Přidávání adres brzy k dispozici')}
                    className="rounded border border-stone-300 px-3 py-1 text-xs text-stone-500 hover:bg-stone-50"
                  >
                    + Přidat doručovací adresu
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Záložky ────────────────────────────────────────────────────

  const tabs = [
    { key: 'hlavni', label: 'Hlavní údaje' },
    { key: 'ucty', label: 'Účty uživatele' },
    { key: 'slevy', label: 'Slevy' },
    { key: 'objednavky', label: `Objednávky (${totalCount})` },
    { key: 'historie', label: 'Historie' },
  ]

  const fullName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={`flex flex-1 flex-col transition-opacity ${isPending ? 'opacity-60' : ''}`}>

      {/* Sticky akční lišta */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            ← Zpět
          </button>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span
                className="inline-block h-2 w-2 rounded-full bg-amber-400"
                title="Neuložené změny"
              />
            )}
            <h2 className="text-base font-semibold text-blue-700">
              Upravit zákazníka {fullName}
            </h2>
            {customer.isBusinessCustomer && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                B2B
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {userRole === 'OWNER' && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Smazat
            </button>
          )}
          <button
            onClick={() => handleSave(true)}
            disabled={isPending}
            className="rounded border border-green-500 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-40"
          >
            Uložit a odejít
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isPending || !isDirty}
            className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            {isPending ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>

      {/* Obsah */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">

          {/* Tab lišta */}
          <div className="mb-6 flex overflow-x-auto rounded-lg border border-stone-200 bg-white">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative whitespace-nowrap px-4 py-3 text-sm transition ${
                  activeTab === tab.key
                    ? 'font-semibold text-stone-900'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {activeTab === tab.key && (
                  <span className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-blue-500" />
                )}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab obsah */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            {activeTab === 'hlavni' && tabHlavni()}
            {activeTab === 'ucty' && (
              <AccountTab
                customerId={customer.id}
                customerEmail={customer.email}
                customerCreatedAt={customer.createdAt}
                isImported={customer.shoptetId !== null}
                hasPassword={customer.hasPassword}
                hasGoogle={customer.hasGoogle}
                account={customer.account}
                userRole={userRole}
              />
            )}
            {activeTab === 'slevy' && <PlaceholderTab label="Brzy" />}
            {activeTab === 'objednavky' && <PlaceholderTab label="Sprint 4-1d" />}
            {activeTab === 'historie' && <PlaceholderTab label="Sprint 4-1d" />}
          </div>

          {customer.shoptetId && (
            <p className="mt-4 text-center text-xs text-stone-300">
              Shoptet ID: #{customer.shoptetId}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
