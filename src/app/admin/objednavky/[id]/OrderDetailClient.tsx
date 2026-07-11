'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { OrderStatus, PaymentStatus } from '@prisma/client'
import { updateOrder, deleteOrder, UpdateOrderData } from './actions'
import type { StatusEmailResult } from '@/lib/dispatch-status-email'
import { EditItemModal } from './EditItemModal'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { STATUS_LABELS } from '@/lib/order-status'
import { formatCZK } from '@/lib/pricing'
import { calculateCartWeightKg, formatWeightKg } from '@/lib/cart-weight'

// ─── Types ────────────────────────────────────────────────────────

export type AddressSnap = {
  firstName?: string
  lastName?: string
  company?: string
  street?: string
  city?: string
  postalCode?: string
  country?: string
  phone?: string
}

export type ContactState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  isBusinessOrder: boolean
  companyName: string
  companyId: string
  vatId: string
}

export type FormState = {
  status: OrderStatus
  paymentMethodId: string
  paymentStatus: PaymentStatus
  trackingNumber: string
  preferredDeliveryDate: string
  deliveryTimeSlot: string
  deliveryNote: string
  contact: ContactState
  billingAddress: AddressSnap
  shippingAddressSameAsBilling: boolean
  shippingAddress: AddressSnap
  internalNote: string
}

export type SerializedItem = {
  id: string
  productName: string
  productSku: string
  variantName: string | null
  quantity: number
  unit: string
  unitPriceWithVat: number
  unitPriceWithoutVat: number
  lineTotalWithVat: number
  lineTotalWithoutVat: number
  lineVatAmount: number
  vatRate: number
  actualWeightKg: number | null
  expectedWeightKg: number | null
  imageUrl: string | null
  fulfilledQuantity: number
  isWeightBased: boolean
  discount: number
  itemNote: string | null
}

export type SerializedNote = {
  id: string
  content: string
  createdAt: string
  adminUserName: string | null
}

export type SerializedPaymentMethod = {
  id: string
  name: string
}

export type SerializedOrder = {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethodId: string | null
  paymentMethodName: string
  shippingMethodName: string
  trackingNumber: string | null
  preferredDeliveryDate: string | null
  deliveryTimeSlot: string | null
  deliveryNote: string | null
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  contactPhone: string
  isBusinessOrder: boolean
  companyName: string | null
  companyId: string | null
  vatId: string | null
  shippingAddressSnapshot: AddressSnap
  billingAddressSnapshot: AddressSnap | null
  subtotalWithVat: number
  shippingPriceWithVat: number
  paymentFeeWithVat: number
  discountAmount: number
  totalVat: number
  totalWithVat: number
  discountCode: string | null
  customerNote: string | null
  internalNote: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  preparedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  paidAt: string | null
  paypalOrderId: string | null
  paymentTransactionId: string | null
  customerId: string | null
  customerRating: 'good' | 'neutral' | 'bad' | null
  items: SerializedItem[]
  notes: SerializedNote[]
}

// ─── Constants ────────────────────────────────────────────────────

const UNIT_LABELS: Record<string, string> = {
  KS: 'ks', KG: 'kg', G_100: '100 g', L: 'l', ML_100: '100 ml',
}

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: 'Nezaplaceno',
  PENDING: 'Čeká na platbu',
  PAID: 'Zaplaceno',
  PARTIALLY_REFUNDED: 'Částečně vráceno',
  REFUNDED: 'Vráceno',
  FAILED: 'Platba selhala',
}

const RATING_EMOJI: Record<string, string> = { good: '😊', neutral: '😐', bad: '😟' }

// ─── Helpers ──────────────────────────────────────────────────────

function buildInitialState(order: SerializedOrder): FormState {
  const shipping = order.shippingAddressSnapshot
  const billing = order.billingAddressSnapshot ?? shipping
  const sameAsBilling =
    !order.billingAddressSnapshot ||
    JSON.stringify(order.billingAddressSnapshot) === JSON.stringify(shipping)

  return {
    status: order.status,
    paymentMethodId: order.paymentMethodId ?? '',
    paymentStatus: order.paymentStatus,
    trackingNumber: order.trackingNumber ?? '',
    preferredDeliveryDate: order.preferredDeliveryDate ?? '',
    deliveryTimeSlot: order.deliveryTimeSlot ?? '',
    deliveryNote: order.deliveryNote ?? '',
    contact: {
      firstName: order.contactFirstName,
      lastName: order.contactLastName,
      email: order.contactEmail,
      phone: order.contactPhone,
      isBusinessOrder: order.isBusinessOrder,
      companyName: order.companyName ?? '',
      companyId: order.companyId ?? '',
      vatId: order.vatId ?? '',
    },
    billingAddress: billing,
    shippingAddressSameAsBilling: sameAsBilling,
    shippingAddress: shipping,
    internalNote: order.internalNote ?? '',
  }
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

function fmtDateLong(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

// ─── AddressDisplay ───────────────────────────────────────────────

function AddressDisplay({ address }: { address: AddressSnap }) {
  return (
    <address className="not-italic text-sm leading-relaxed text-stone-700">
      {(address.firstName || address.lastName) && (
        <p className="font-medium">
          {address.firstName} {address.lastName}
        </p>
      )}
      {address.company && <p>{address.company}</p>}
      {address.street && <p>{address.street}</p>}
      {(address.postalCode || address.city) && (
        <p>
          {address.postalCode} {address.city}
        </p>
      )}
      {address.country && address.country !== 'CZ' && <p>{address.country}</p>}
    </address>
  )
}

// ─── ContactModal ─────────────────────────────────────────────────

function ContactModal({
  initial,
  onSave,
  onClose,
}: {
  initial: ContactState
  onSave: (c: ContactState) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof ContactState, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h3 className="font-semibold text-stone-900">Upravit kontaktní údaje</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 p-6">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Jméno</label>
            <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Příjmení</label>
            <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">E-mail</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Telefon</label>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.isBusinessOrder}
                onChange={(e) => set('isBusinessOrder', e.target.checked)}
                className="rounded" />
              Firma (B2B)
            </label>
          </div>
          {form.isBusinessOrder && (
            <>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-stone-500">Název firmy</label>
                <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-stone-500">IČO</label>
                <input value={form.companyId} onChange={(e) => set('companyId', e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-stone-500">DIČ</label>
                <input value={form.vatId} onChange={(e) => set('vatId', e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
          <button onClick={onClose}
            className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
            Zrušit
          </button>
          <button onClick={() => onSave(form)}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Potvrdit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AddressModal ─────────────────────────────────────────────────

function AddressModal({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string
  initial: AddressSnap
  onSave: (a: AddressSnap) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<AddressSnap>(initial)
  const set = (k: keyof AddressSnap, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h3 className="font-semibold text-stone-900">{title}</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 p-6">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Jméno</label>
            <input value={form.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Příjmení</label>
            <input value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-stone-500">Firma (nepovinné)</label>
            <input value={form.company ?? ''} onChange={(e) => set('company', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-stone-500">Ulice a číslo popisné</label>
            <input value={form.street ?? ''} onChange={(e) => set('street', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Město</label>
            <input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">PSČ</label>
            <input value={form.postalCode ?? ''} onChange={(e) => set('postalCode', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-stone-500">Země</label>
            <input value={form.country ?? 'CZ'} onChange={(e) => set('country', e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
          <button onClick={onClose}
            className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
            Zrušit
          </button>
          <button onClick={() => onSave(form)}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Potvrdit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Email toast helper ───────────────────────────────────────────

function buildToastMessage(email: StatusEmailResult): string {
  const parts: string[] = ['Stav změněn.']
  if (email.invoiceGenerated && email.invoiceNumber) {
    parts.push(`Faktura ${email.invoiceNumber} vystavena.`)
  }
  if (!email.attempted) return parts.join(' ')
  if (!email.sent) return parts.join(' ')
  if (email.invoiceAttached) {
    parts.push(email.testMode
      ? `Email s fakturou odeslán (TEST → ${email.recipient}).`
      : 'Email s fakturou odeslán zákazníkovi.')
  } else {
    parts.push(email.testMode
      ? `Email odeslán (TEST → ${email.recipient}).`
      : 'Email odeslán zákazníkovi.')
  }
  return parts.join(' ')
}

function showEmailToast(email: StatusEmailResult) {
  if (email.attempted && !email.sent) {
    const inv = email.invoiceNumber ? ` Faktura ${email.invoiceNumber} vystavena.` : ''
    toast.error(`Stav změněn.${inv} Email se nepodařilo odeslat: ${email.error ?? 'neznámá chyba'}`)
    return
  }
  toast.success(buildToastMessage(email))
}

// ─── OrderDetailClient ────────────────────────────────────────────

interface Props {
  order: SerializedOrder
  paymentMethods: SerializedPaymentMethod[]
  prevOrderId: string | null
  nextOrderId: string | null
  allowedStatuses: OrderStatus[]
  existingInvoice: { id: string; number: string } | null
  proposedInvoiceNumber: string
  defaultDueDays: number
}

export function OrderDetailClient({
  order,
  paymentMethods,
  prevOrderId,
  nextOrderId,
  allowedStatuses,
  existingInvoice,
  proposedInvoiceNumber,
  defaultDueDays,
}: Props) {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>(() => buildInitialState(order))
  const [savedState, setSavedState] = useState<FormState>(() => buildInitialState(order))
  const [activeTab, setActiveTab] = useState('polozky')
  const [showContactModal, setShowContactModal] = useState(false)
  const [showBillingModal, setShowBillingModal] = useState(false)
  const [showShippingModal, setShowShippingModal] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isDirty = JSON.stringify(formState) !== JSON.stringify(savedState)

  // Reset form after save (triggered when server re-fetches with new updatedAt)
  useEffect(() => {
    const next = buildInitialState(order)
    setFormState(next)
    setSavedState(next)
  }, [order.updatedAt])

  // Warn on browser navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function navigate(href: string) {
    if (isDirty && !window.confirm('Máte neuložené změny. Opravdu chcete opustit stránku?')) return
    router.push(href)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  function buildSaveData(): UpdateOrderData {
    const s = formState
    return {
      status: s.status,
      paymentMethodId: s.paymentMethodId || null,
      paymentStatus: s.paymentStatus,
      trackingNumber: s.trackingNumber || null,
      preferredDeliveryDate: s.preferredDeliveryDate || null,
      deliveryTimeSlot: s.deliveryTimeSlot || null,
      deliveryNote: s.deliveryNote || null,
      contactFirstName: s.contact.firstName,
      contactLastName: s.contact.lastName,
      contactEmail: s.contact.email,
      contactPhone: s.contact.phone,
      isBusinessOrder: s.contact.isBusinessOrder,
      companyName: s.contact.companyName || null,
      companyId: s.contact.companyId || null,
      vatId: s.contact.vatId || null,
      billingAddress: s.billingAddress as Record<string, unknown>,
      shippingAddress: (s.shippingAddressSameAsBilling
        ? s.billingAddress
        : s.shippingAddress) as Record<string, unknown>,
      internalNote: s.internalNote || null,
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await updateOrder(order.id, buildSaveData())
        // Toast PŘED refreshem — refresh překreslí stránku a zničí toast
        if (result?.emailResult) {
          showEmailToast(result.emailResult)
        } else {
          toast.success('Uloženo.')
        }
        setTimeout(() => router.refresh(), 100)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání.')
      }
    })
  }

  function handleSaveAndLeave() {
    if (!isDirty) {
      router.push('/admin/objednavky')
      return
    }
    startTransition(async () => {
      try {
        await updateOrder(order.id, buildSaveData())
        router.push('/admin/objednavky')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při ukládání.')
      }
    })
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Smazat objednávku ${order.orderNumber}?\n\nTato akce je nevratná.`,
      )
    )
      return
    startTransition(async () => {
      try {
        await deleteOrder(order.id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Chyba při mazání.')
      }
    })
  }

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
  const fulfilledQty = order.items.reduce((s, i) => s + i.fulfilledQuantity, 0)

  const TABS = [
    { id: 'polozky', label: 'Položky' },
    { id: 'kompletace', label: `Kompletace (${fulfilledQty}/${totalQty})` },
    { id: 'historie', label: 'Historie' },
    { id: 'doplnujici', label: 'Doplňující informace' },
    { id: 'doklady', label: 'Doklady' },
  ]

  return (
    <>
      {/* ── STICKY ACTION BAR ── */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              {isPending ? 'Ukládám…' : 'Uložit'}
            </button>
            <button
              onClick={handleSaveAndLeave}
              disabled={isPending}
              className="rounded border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-40"
            >
              Uložit a odejít
            </button>
            <div className="mx-1 h-5 w-px bg-stone-200" />
            <button
              onClick={() => window.print()}
              className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              Tisk dodacího listu
            </button>
            <button
              disabled
              className="cursor-not-allowed rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-300"
            >
              Tisk štítku
            </button>
            {existingInvoice ? (
              <a
                href={`/admin/faktury/${existingInvoice.id}`}
                className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
              >
                Faktura {existingInvoice.number}
              </a>
            ) : (
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
              >
                Vystavit fakturu
              </button>
            )}
            <button
              disabled
              title="Brzy"
              className="cursor-not-allowed rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-300"
            >
              Kopie
            </button>
            {order.status === 'CANCELLED' && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Smazat
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => prevOrderId && navigate(`/admin/objednavky/${prevOrderId}`)}
              disabled={!prevOrderId}
              title="Předchozí objednávka"
              className="rounded border border-stone-300 px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ←
            </button>
            <button
              onClick={() => nextOrderId && navigate(`/admin/objednavky/${nextOrderId}`)}
              disabled={!nextOrderId}
              title="Další objednávka"
              className="rounded border border-stone-300 px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>
        {isDirty && <div className="h-0.5 w-full bg-amber-400" />}
      </div>

      {/* ── MAIN ── */}
      <main className="flex-1 bg-stone-50 p-6">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">{order.orderNumber}</h2>
          <p className="mt-0.5 text-sm text-stone-500">Přijata {fmtDateLong(order.createdAt)}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── LEFT 2/3 ── */}
          <div className="space-y-6 lg:col-span-2">

            {/* Order info – editable */}
            <section className="rounded-lg border border-stone-200 bg-white">
              <h3 className="border-b border-stone-100 px-5 py-3 text-sm font-semibold text-stone-700">
                Detaily objednávky
              </h3>
              <div className="grid grid-cols-2 gap-4 p-5">
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Stav</label>
                  <select
                    value={formState.status}
                    onChange={(e) => update('status', e.target.value as OrderStatus)}
                    className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    <option value={order.status}>
                      {STATUS_LABELS[order.status]}
                      {formState.status === order.status ? ' (aktuální)' : ''}
                    </option>
                    {allowedStatuses
                      .filter((s) => s !== order.status)
                      .map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Forma úhrady</label>
                  <select
                    value={formState.paymentMethodId}
                    onChange={(e) => update('paymentMethodId', e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">— bez formy úhrady —</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Stav platby</label>
                  <select
                    value={formState.paymentStatus}
                    onChange={(e) => update('paymentStatus', e.target.value as PaymentStatus)}
                    className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    <option value="UNPAID">Nezaplaceno</option>
                    <option value="PENDING">Čeká na platbu</option>
                    <option value="PAID">Zaplaceno</option>
                    <option value="FAILED">Platba selhala</option>
                    {!['UNPAID', 'PENDING', 'PAID', 'FAILED'].includes(order.paymentStatus) && (
                      <option value={order.paymentStatus}>
                        {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Číslo zásilky</label>
                  <input
                    type="text"
                    value={formState.trackingNumber}
                    onChange={(e) => update('trackingNumber', e.target.value)}
                    placeholder="např. 1Z999AA10123456784"
                    className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Termín doručení</label>
                  <input
                    type="date"
                    value={formState.preferredDeliveryDate}
                    onChange={(e) => update('preferredDeliveryDate', e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-500">Časové okno</label>
                  <input
                    type="text"
                    value={formState.deliveryTimeSlot}
                    onChange={(e) => update('deliveryTimeSlot', e.target.value)}
                    placeholder="např. 9–12"
                    className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-6 border-t border-stone-100 px-5 py-2.5 text-xs text-stone-400">
                <span>Zdroj: E-shop</span>
                <span>Daňový mód: {order.isBusinessOrder ? 'B2B' : 'B2C (DPH 12 %)'}</span>
                <span>Přijato: {fmtDate(order.createdAt)}</span>
                <span>Prodejní kanál: E-shop</span>
              </div>
            </section>

            {/* Tabs */}
            <section className="rounded-lg border border-stone-200 bg-white">
              <div className="flex overflow-x-auto border-b border-stone-200">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative whitespace-nowrap px-4 py-3 text-sm transition ${
                      activeTab === tab.id
                        ? 'font-semibold text-stone-900'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {activeTab === tab.id && (
                      <span className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-green-500" />
                    )}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab: Položky */}
              {activeTab === 'polozky' && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-stone-50 text-xs text-stone-500">
                        <tr>
                          <th className="p-3 text-left">Produkt</th>
                          <th className="p-3 text-left">SKU</th>
                          <th className="p-3 text-center">Jedn.</th>
                          <th className="p-3 text-center">Množ.</th>
                          <th className="p-3 text-center">Skut. váha</th>
                          <th className="p-3 text-right">Jedn. cena</th>
                          <th className="p-3 text-right">Celkem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id} className="border-t border-stone-100">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.productName}
                                    className="h-10 w-10 rounded border border-stone-200 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded border border-stone-200 bg-stone-50 text-stone-300">
                                    <svg
                                      className="h-5 w-5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                      />
                                    </svg>
                                  </div>
                                )}
                                <div>
                                  <button
                                    onClick={() => setEditingItemId(item.id)}
                                    title="Klikněte pro úpravu"
                                    className="cursor-pointer text-left font-medium text-stone-900 hover:text-blue-600 hover:underline"
                                  >
                                    {item.productName}
                                  </button>
                                  {item.variantName && (
                                    <p className="text-xs text-stone-500">{item.variantName}</p>
                                  )}
                                  {item.itemNote && (
                                    <p className="text-xs italic text-stone-400">{item.itemNote}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-mono text-xs text-stone-500">
                              {item.productSku}
                            </td>
                            <td className="p-3 text-center text-stone-600">
                              {UNIT_LABELS[item.unit] ?? item.unit}
                            </td>
                            <td className="p-3 text-center">
                              {item.expectedWeightKg != null
                                ? `${item.expectedWeightKg.toFixed(3)} kg`
                                : item.quantity}
                            </td>
                            <td className="p-3 text-center text-stone-500">
                              {item.actualWeightKg != null ? (
                                <span title={`Naváženo ${item.actualWeightKg.toFixed(3)} kg`}>
                                  {item.actualWeightKg.toFixed(3)} kg ⚖️
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {formatCZK(item.unitPriceWithVat)}
                            </td>
                            <td className="p-3 text-right font-semibold">
                              {formatCZK(item.lineTotalWithVat)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-stone-100 p-5">
                    <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                      <div className="flex justify-between text-stone-500">
                        <span>Celková hmotnost (odhad)</span>
                        <span>
                          {formatWeightKg(calculateCartWeightKg(order.items.map((i) => ({
                            quantity: i.quantity,
                            isWeightBased: i.isWeightBased,
                            isVariant: i.variantName != null,
                            unit: i.unit,
                            weightGrams: i.expectedWeightKg != null ? i.expectedWeightKg * 1000 : null,
                          }))))}
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Mezisoučet zboží</span>
                        <span>{formatCZK(order.subtotalWithVat)}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Doprava ({order.shippingMethodName})</span>
                        <span>{formatCZK(order.shippingPriceWithVat)}</span>
                      </div>
                      {order.paymentFeeWithVat > 0 && (
                        <div className="flex justify-between text-stone-600">
                          <span>Poplatek za platbu</span>
                          <span>{formatCZK(order.paymentFeeWithVat)}</span>
                        </div>
                      )}
                      {order.discountAmount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>
                            Sleva
                            {order.discountCode && (
                              <span className="ml-1 rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs">
                                {order.discountCode}
                              </span>
                            )}
                          </span>
                          <span>−{formatCZK(order.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-stone-100 pt-1.5 text-xs text-stone-400">
                        <span>Z toho DPH</span>
                        <span>{formatCZK(order.totalVat)}</span>
                      </div>
                      <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-stone-900">
                        <span>Celkem</span>
                        <span>{formatCZK(order.totalWithVat)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Tab: Kompletace */}
              {activeTab === 'kompletace' && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-stone-400">
                  <p className="text-lg font-medium">Kompletace</p>
                  <p className="text-sm">Dostupné v Sprint 2B-2</p>
                </div>
              )}

              {/* Tab: Historie */}
              {activeTab === 'historie' && (
                <div className="p-5">
                  {order.notes.length === 0 ? (
                    <p className="text-sm text-stone-400">Zatím žádné záznamy.</p>
                  ) : (
                    <ol>
                      {order.notes.map((note, i) => (
                        <li key={note.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-stone-400 bg-white" />
                            {i < order.notes.length - 1 && (
                              <div className="mt-1 w-0.5 flex-1 bg-stone-200" />
                            )}
                          </div>
                          <div className="pb-5">
                            <p className="text-xs text-stone-400">
                              {fmtDate(note.createdAt)} ·{' '}
                              <span className="font-medium text-stone-500">
                                {note.adminUserName ?? 'Systém'}
                              </span>
                            </p>
                            <p className="mt-0.5 text-sm text-stone-800">{note.content}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Tab: Doplňující informace */}
              {activeTab === 'doplnujici' && (
                <div className="space-y-5 p-5">
                  {order.customerNote && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-stone-500">
                        Poznámka od zákazníka
                      </p>
                      <p className="rounded bg-stone-50 p-3 text-sm whitespace-pre-wrap text-stone-700">
                        {order.customerNote}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-500">
                      Interní poznámka (pro obsluhu)
                    </label>
                    <textarea
                      value={formState.internalNote}
                      onChange={(e) => update('internalNote', e.target.value)}
                      rows={4}
                      placeholder="Viditelné pouze pro administrátory…"
                      className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Tab: Doklady */}
              {activeTab === 'doklady' && (
                <div className="p-5">
                  {existingInvoice ? (
                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-stone-800">
                          Faktura {existingInvoice.number}
                        </p>
                        <p className="text-xs text-stone-500">Daňový doklad</p>
                      </div>
                      <a
                        href={`/admin/faktury/${existingInvoice.id}`}
                        className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        Otevřít
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12 text-stone-400">
                      <p className="text-sm">K této objednávce zatím nebyla vystavena faktura.</p>
                      <button
                        onClick={() => setShowInvoiceModal(true)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Vystavit fakturu
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── RIGHT 1/3 ── */}
          <div className="space-y-4">

            {/* Contact */}
            <section className="rounded-lg border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-stone-700">Kontakt na zákazníka</h3>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  UPRAVIT
                </button>
              </div>
              <div className="space-y-1.5 p-4 text-sm">
                <p className="font-medium text-stone-900">
                  {formState.contact.firstName} {formState.contact.lastName}
                  {order.customerRating && (
                    <span className="ml-1.5 text-base">
                      {RATING_EMOJI[order.customerRating]}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1.5 text-stone-700">
                  <a
                    href={`mailto:${formState.contact.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {formState.contact.email}
                  </a>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(formState.contact.email)
                        .then(() => toast.success('Zkopírováno'))
                    }
                    className="text-stone-400 hover:text-stone-600"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-stone-700">
                  <a
                    href={`tel:${formState.contact.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {formState.contact.phone}
                  </a>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(formState.contact.phone)
                        .then(() => toast.success('Zkopírováno'))
                    }
                    className="text-stone-400 hover:text-stone-600"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {formState.contact.isBusinessOrder && (
                  <div className="mt-1 space-y-0.5 rounded bg-stone-50 px-3 py-2 text-xs text-stone-600">
                    {formState.contact.companyName && (
                      <p>Firma: {formState.contact.companyName}</p>
                    )}
                    {formState.contact.companyId && (
                      <p>IČO: {formState.contact.companyId}</p>
                    )}
                    {formState.contact.vatId && <p>DIČ: {formState.contact.vatId}</p>}
                  </div>
                )}
                {!order.customerId && (
                  <p className="mt-1 text-xs text-stone-400">Hostovská objednávka (bez účtu)</p>
                )}
                <p className="mt-2 text-xs text-stone-400">
                  Snapshot z objednávky — změna profilu zákazníka tento záznam nezmění. Upravit lze ručně tlačítkem výše.
                </p>
              </div>
            </section>

            {/* Billing address */}
            <section className="rounded-lg border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-stone-700">Fakturační adresa</h3>
                <button
                  onClick={() => setShowBillingModal(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  UPRAVIT
                </button>
              </div>
              <div className="p-4">
                <AddressDisplay address={formState.billingAddress} />
              </div>
            </section>

            {/* Shipping address */}
            <section className="rounded-lg border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-stone-700">Doručovací adresa</h3>
                {!formState.shippingAddressSameAsBilling && (
                  <button
                    onClick={() => setShowShippingModal(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    UPRAVIT
                  </button>
                )}
              </div>
              <div className="p-4">
                <label className="mb-3 flex items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={formState.shippingAddressSameAsBilling}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        shippingAddressSameAsBilling: e.target.checked,
                        shippingAddress: e.target.checked
                          ? prev.billingAddress
                          : prev.shippingAddress,
                      }))
                    }
                    className="rounded"
                  />
                  Stejná jako fakturační
                </label>
                {formState.shippingAddressSameAsBilling ? (
                  <p className="text-sm italic text-stone-400">Stejná jako fakturační</p>
                ) : (
                  <AddressDisplay address={formState.shippingAddress} />
                )}
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-stone-500">
                    Poznámka k doručení
                  </label>
                  <input
                    type="text"
                    value={formState.deliveryNote}
                    onChange={(e) => update('deliveryNote', e.target.value)}
                    placeholder="Zazvonit dvakrát, vchod ze dvora…"
                    className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* Shipping & payment info */}
            <section className="rounded-lg border border-stone-200 bg-white">
              <h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-700">
                Doprava a platba
              </h3>
              <dl className="divide-y divide-stone-100 text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-stone-500">Způsob dopravy</dt>
                  <dd className="font-medium text-stone-800">{order.shippingMethodName}</dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-stone-500">Cena dopravy</dt>
                  <dd className="font-medium text-stone-800">
                    {formatCZK(order.shippingPriceWithVat)}
                  </dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-stone-500">Způsob platby</dt>
                  <dd className="font-medium text-stone-800">{order.paymentMethodName}</dd>
                </div>
                {order.paidAt && (
                  <div className="flex justify-between px-4 py-2.5">
                    <dt className="text-stone-500">Zaplaceno</dt>
                    <dd className="text-stone-800">{fmtDate(order.paidAt)}</dd>
                  </div>
                )}
                {order.paypalOrderId && (
                  <div className="flex justify-between gap-2 px-4 py-2.5">
                    <dt className="shrink-0 text-stone-500">PayPal</dt>
                    <dd className="break-all text-right font-mono text-xs text-stone-600">
                      {order.paypalOrderId}
                      {order.paymentTransactionId && (
                        <span className="block text-stone-400">transakce {order.paymentTransactionId}</span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Lifecycle dates */}
            <div className="rounded-lg border border-stone-200 bg-white">
              <h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-700">
                Stav objednávky
              </h3>
              <dl className="divide-y divide-stone-100 text-sm">
                {(
                  [
                    ['Vytvořena', order.createdAt],
                    order.confirmedAt ? ['Potvrzena', order.confirmedAt] : null,
                    order.preparedAt ? ['Připravena', order.preparedAt] : null,
                    order.shippedAt ? ['Odesláno', order.shippedAt] : null,
                    order.deliveredAt ? ['Doručeno', order.deliveredAt] : null,
                    order.cancelledAt ? ['Stornováno', order.cancelledAt] : null,
                  ] as Array<[string, string] | null>
                )
                  .filter((x): x is [string, string] => Boolean(x))
                  .map(([label, iso]) => (
                    <div key={label} className="flex justify-between px-4 py-2.5">
                      <dt className="text-stone-500">{label}</dt>
                      <dd className="text-stone-800">{fmtDate(iso)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        </div>
      </main>

      {/* ── MODALS ── */}
      {showContactModal && (
        <ContactModal
          initial={formState.contact}
          onSave={(contact) => {
            setFormState((prev) => ({ ...prev, contact }))
            setShowContactModal(false)
          }}
          onClose={() => setShowContactModal(false)}
        />
      )}
      {showBillingModal && (
        <AddressModal
          title="Fakturační adresa"
          initial={formState.billingAddress}
          onSave={(address) => {
            setFormState((prev) => ({
              ...prev,
              billingAddress: address,
              shippingAddress: prev.shippingAddressSameAsBilling
                ? address
                : prev.shippingAddress,
            }))
            setShowBillingModal(false)
          }}
          onClose={() => setShowBillingModal(false)}
        />
      )}
      {showShippingModal && (
        <AddressModal
          title="Doručovací adresa"
          initial={formState.shippingAddress}
          onSave={(address) => {
            setFormState((prev) => ({ ...prev, shippingAddress: address }))
            setShowShippingModal(false)
          }}
          onClose={() => setShowShippingModal(false)}
        />
      )}
      {editingItemId !== null && (() => {
        const editItem = order.items.find((i) => i.id === editingItemId)
        if (!editItem) return null
        return (
          <EditItemModal
            item={editItem}
            onClose={() => setEditingItemId(null)}
            onSaved={() => {
              setEditingItemId(null)
              router.refresh()
            }}
          />
        )
      })()}
      {showInvoiceModal && (
        <CreateInvoiceModal
          orderId={order.id}
          orderNumber={order.orderNumber}
          items={order.items}
          paymentMethodName={order.paymentMethodName}
          isBusinessOrder={order.isBusinessOrder}
          proposedInvoiceNumber={proposedInvoiceNumber}
          defaultDueDays={defaultDueDays}
          onClose={() => setShowInvoiceModal(false)}
          onCreated={(invoiceId) => {
            setShowInvoiceModal(false)
            router.push(`/admin/faktury/${invoiceId}`)
          }}
        />
      )}
    </>
  )
}
