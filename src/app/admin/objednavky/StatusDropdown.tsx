'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OrderStatus } from '@prisma/client'
import { updateOrderStatus } from './actions'
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/order-status'
import type { StatusEmailResult } from '@/lib/dispatch-status-email'

const ALL_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'PENDING', label: STATUS_LABELS.PENDING },
  { value: 'CONFIRMED', label: STATUS_LABELS.CONFIRMED },
  { value: 'PROCESSING', label: STATUS_LABELS.PROCESSING },
  { value: 'READY', label: STATUS_LABELS.READY },
  { value: 'SHIPPED', label: STATUS_LABELS.SHIPPED },
  { value: 'DELIVERED', label: STATUS_LABELS.DELIVERED },
  { value: 'CANCELLED', label: STATUS_LABELS.CANCELLED },
  { value: 'REFUNDED', label: STATUS_LABELS.REFUNDED },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-800',
  CONFIRMED: 'border-blue-300 bg-blue-50 text-blue-800',
  PROCESSING: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  READY: 'border-purple-300 bg-purple-50 text-purple-800',
  SHIPPED: 'border-cyan-300 bg-cyan-50 text-cyan-800',
  DELIVERED: 'border-green-300 bg-green-50 text-green-800',
  CANCELLED: 'border-stone-300 bg-stone-50 text-stone-500',
  REFUNDED: 'border-stone-300 bg-stone-50 text-stone-500',
}

function buildToastMessage(email: StatusEmailResult): string {
  const parts: string[] = ['Stav změněn.']
  if (email.invoiceGenerated && email.invoiceNumber) {
    parts.push(`Faktura ${email.invoiceNumber} vystavena.`)
  }
  if (!email.attempted) return parts.join(' ')
  if (!email.sent) return parts.join(' ') // chyba se ukáže přes toast.error
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

// Sestup = přechod na nižší pořadové číslo v lineárním toku
function isLinearDowngrade(from: OrderStatus, to: OrderStatus): boolean {
  const f = STATUS_ORDER[from]
  const t = STATUS_ORDER[to]
  return f !== undefined && t !== undefined && t < f
}

interface Props {
  orderId: string
  currentStatus: OrderStatus
  allowedStatuses: OrderStatus[]
}

export function StatusDropdown({ orderId, currentStatus, allowedStatuses }: Props) {
  const router = useRouter()
  const [value, setValue] = useState<OrderStatus>(currentStatus)
  const [isPending, startTransition] = useTransition()

  const noTransitions = allowedStatuses.length === 0
  const colorClass = STATUS_COLORS[value] ?? 'border-stone-300 bg-white text-stone-700'

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as OrderStatus
    const prevStatus = value
    if (newStatus === prevStatus) return

    // Sestup stavu — vyžaduje potvrzení (relevantní pro ADMIN/OWNER, STAFF sem nedojde)
    if (isLinearDowngrade(prevStatus, newStatus)) {
      const ok = window.confirm(
        `Přechod stavu zpět:\n„${STATUS_LABELS[prevStatus]}" → „${STATUS_LABELS[newStatus]}"\n\nOpravdu chcete pokračovat?`,
      )
      if (!ok) return
    }

    setValue(newStatus) // Optimistický update
    startTransition(async () => {
      try {
        const result = await updateOrderStatus(orderId, newStatus)
        showEmailToast(result.email) // toast první — server action nevolá revalidatePath
        router.refresh()             // 2. refresh až po toastu
      } catch (err) {
        setValue(prevStatus) // Vrátit UI při chybě
        toast.error(err instanceof Error ? err.message : 'Chyba při změně stavu.')
      }
    })
  }

  return (
    <select
      value={value}
      disabled={isPending || noTransitions}
      title={noTransitions ? 'Z tohoto stavu není k dispozici žádný přechod' : undefined}
      className={`rounded border px-2 py-1 text-xs font-medium transition ${colorClass} ${
        isPending
          ? 'cursor-wait opacity-60'
          : noTransitions
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer'
      }`}
      onChange={handleChange}
    >
      {ALL_STATUSES.map(({ value: v, label }) => (
        <option key={v} value={v} disabled={!allowedStatuses.includes(v)}>
          {label}
        </option>
      ))}
    </select>
  )
}
