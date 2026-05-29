'use server'

import { OrderStatus, AdminRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/order-status'
import { dispatchStatusEmail, type StatusEmailResult } from '@/lib/dispatch-status-email'

const STAFF_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'PROCESSING',
  PROCESSING: 'READY',
}

const TERMINAL_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED']

function validateTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: AdminRole,
): string | null {
  if (TERMINAL_STATUSES.includes(to)) {
    if (from === 'DELIVERED') return 'Doručenou objednávku nelze stornovat ani vrátit.'
    if (role === 'STAFF') return 'Obsluha nemá oprávnění stornovat nebo vracet objednávky.'
    return null
  }
  if (role === 'STAFF') {
    if (STAFF_TRANSITIONS[from] !== to) {
      const fromLabel = STATUS_LABELS[from]
      const toLabel = STAFF_TRANSITIONS[from] ? STATUS_LABELS[STAFF_TRANSITIONS[from]!] : '—'
      return (
        `Z stavu „${fromLabel}" může obsluha přejít jen na „${toLabel}". ` +
        `Povolené přechody: Čeká→Zpracovává se, Zpracovává se→Připraveno.`
      )
    }
    return null
  }
  void STATUS_ORDER
  return null
}

export type UpdateOrderStatusResult = {
  email: StatusEmailResult
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
): Promise<UpdateOrderStatusResult> {
  const { user } = await requireAuth()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  })
  if (!order) throw new Error('Objednávka nenalezena.')

  const noEmail: StatusEmailResult = {
    attempted: false, sent: false, recipient: null, error: null, testMode: false,
    invoiceGenerated: false, invoiceAttached: false, invoiceNumber: null,
  }
  if (order.status === newStatus) return { email: noEmail }

  const error = validateTransition(order.status, newStatus, user.role)
  if (error) throw new Error(error)

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: newStatus } }),
    prisma.orderNote.create({
      data: {
        orderId,
        content: `Stav změněn z „${STATUS_LABELS[order.status]}" na „${STATUS_LABELS[newStatus]}".`,
        createdBy: user.id,
      },
    }),
  ])

  const email = await dispatchStatusEmail(orderId, newStatus, user.id)
  return { email }
}
