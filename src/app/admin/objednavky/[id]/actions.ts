'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { STATUS_LABELS, computeAllowedStatuses } from '@/lib/order-status'
import { calculateWeightBasedPrice, priceWithoutVat, roundMoney } from '@/lib/pricing'
import { dispatchStatusEmail, type StatusEmailResult } from '@/lib/dispatch-status-email'

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Nezaplaceno',
  PENDING: 'Čeká na platbu',
  PAID: 'Zaplaceno',
  PARTIALLY_REFUNDED: 'Částečně vráceno',
  REFUNDED: 'Vráceno',
  FAILED: 'Platba selhala',
}

// ─── cancelOrder ─────────────────────────────────────────────────

export async function cancelOrder(orderId: string) {
  const { user } = await requireAuth()

  if (user.role === 'STAFF') {
    throw new Error('Obsluha nemá oprávnění stornovat objednávky.')
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  })
  if (!order) throw new Error('Objednávka nenalezena.')
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return
  if (order.status === 'DELIVERED') {
    throw new Error('Doručenou objednávku nelze stornovat.')
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    }),
    prisma.orderNote.create({
      data: {
        orderId,
        content: `Stav změněn z „${STATUS_LABELS[order.status]}" na „${STATUS_LABELS.CANCELLED}".`,
        createdBy: user.id,
      },
    }),
  ])

  redirect(`/admin/objednavky/${orderId}`)
}

// ─── updateOrder ─────────────────────────────────────────────────

export interface UpdateOrderData {
  status: OrderStatus
  paymentMethodId: string | null
  paymentStatus: PaymentStatus
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
  billingAddress: Record<string, unknown>
  shippingAddress: Record<string, unknown>
  internalNote: string | null
}

export type UpdateOrderResult = {
  emailResult?: StatusEmailResult  // přítomno pouze pokud se změnil stav
}

export async function updateOrder(orderId: string, data: UpdateOrderData): Promise<UpdateOrderResult> {
  const { user } = await requireAuth()

  const current = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      paymentStatus: true,
      paymentMethodId: true,
      trackingNumber: true,
      preferredDeliveryDate: true,
      deliveryTimeSlot: true,
      deliveryNote: true,
      contactFirstName: true,
      contactLastName: true,
      contactEmail: true,
      contactPhone: true,
      isBusinessOrder: true,
      companyName: true,
      companyId: true,
      vatId: true,
      billingAddressSnapshot: true,
      shippingAddressSnapshot: true,
      internalNote: true,
      paidAt: true,
      confirmedAt: true,
      preparedAt: true,
      shippedAt: true,
      deliveredAt: true,
      cancelledAt: true,
    },
  })
  if (!current) throw new Error('Objednávka nenalezena.')

  const update: Prisma.OrderUpdateInput = {}
  const noteContents: string[] = []

  // Status
  if (data.status !== current.status) {
    const allowed = computeAllowedStatuses(current.status, user.role)
    if (!allowed.includes(data.status)) {
      throw new Error(
        `Přechod z „${STATUS_LABELS[current.status]}" na „${STATUS_LABELS[data.status]}" není povolen.`,
      )
    }
    update.status = data.status
    noteContents.push(
      `Stav změněn z „${STATUS_LABELS[current.status]}" na „${STATUS_LABELS[data.status]}".`,
    )
    const now = new Date()
    if (data.status === 'CONFIRMED' && !current.confirmedAt) update.confirmedAt = now
    if (data.status === 'READY' && !current.preparedAt) update.preparedAt = now
    if (data.status === 'SHIPPED' && !current.shippedAt) update.shippedAt = now
    if (data.status === 'DELIVERED' && !current.deliveredAt) update.deliveredAt = now
    if (data.status === 'CANCELLED' && !current.cancelledAt) update.cancelledAt = now
  }

  // Payment status
  if (data.paymentStatus !== current.paymentStatus) {
    update.paymentStatus = data.paymentStatus
    noteContents.push(`Platba změněna na „${PAYMENT_STATUS_LABELS[data.paymentStatus]}".`)
    if (data.paymentStatus === 'PAID' && !current.paidAt) update.paidAt = new Date()
  }

  // Payment method
  const newPaymentMethodId = data.paymentMethodId || null
  if (newPaymentMethodId !== current.paymentMethodId) {
    update.paymentMethod = newPaymentMethodId
      ? { connect: { id: newPaymentMethodId } }
      : { disconnect: true }
    noteContents.push('Aktualizována forma úhrady.')
  }

  // Tracking number
  const newTracking = data.trackingNumber || null
  if (newTracking !== current.trackingNumber) {
    update.trackingNumber = newTracking
    if (newTracking) noteContents.push(`Přidáno číslo zásilky: ${newTracking}.`)
    else noteContents.push('Odstraněno číslo zásilky.')
  }

  // Delivery fields (no audit)
  const newDeliveryDate = data.preferredDeliveryDate ? new Date(data.preferredDeliveryDate) : null
  if ((newDeliveryDate?.toDateString() ?? null) !== (current.preferredDeliveryDate?.toDateString() ?? null)) {
    update.preferredDeliveryDate = newDeliveryDate
  }
  if ((data.deliveryTimeSlot || null) !== current.deliveryTimeSlot) {
    update.deliveryTimeSlot = data.deliveryTimeSlot || null
  }
  if ((data.deliveryNote || null) !== current.deliveryNote) {
    update.deliveryNote = data.deliveryNote || null
  }

  // Contact
  const contactChanged =
    data.contactFirstName !== current.contactFirstName ||
    data.contactLastName !== current.contactLastName ||
    data.contactEmail !== current.contactEmail ||
    data.contactPhone !== current.contactPhone ||
    data.isBusinessOrder !== current.isBusinessOrder ||
    (data.companyName || null) !== current.companyName ||
    (data.companyId || null) !== current.companyId ||
    (data.vatId || null) !== current.vatId

  if (contactChanged) {
    update.contactFirstName = data.contactFirstName
    update.contactLastName = data.contactLastName
    update.contactEmail = data.contactEmail
    update.contactPhone = data.contactPhone
    update.isBusinessOrder = data.isBusinessOrder
    update.companyName = data.companyName || null
    update.companyId = data.companyId || null
    update.vatId = data.vatId || null
    noteContents.push('Aktualizovány kontaktní údaje.')
  }

  // Billing address
  if (JSON.stringify(data.billingAddress) !== JSON.stringify(current.billingAddressSnapshot)) {
    update.billingAddressSnapshot = data.billingAddress as Prisma.InputJsonValue
    noteContents.push('Aktualizována fakturační adresa.')
  }

  // Shipping address
  if (JSON.stringify(data.shippingAddress) !== JSON.stringify(current.shippingAddressSnapshot)) {
    update.shippingAddressSnapshot = data.shippingAddress as Prisma.InputJsonValue
    noteContents.push('Aktualizována doručovací adresa.')
  }

  // Internal note (no audit)
  if ((data.internalNote || null) !== current.internalNote) {
    update.internalNote = data.internalNote || null
  }

  if (Object.keys(update).length === 0) return {}

  const statusChanged = data.status !== current.status

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: update }),
    ...noteContents.map((content) =>
      prisma.orderNote.create({ data: { orderId, content, createdBy: user.id } }),
    ),
  ])

  revalidatePath(`/admin/objednavky/${orderId}`)
  revalidatePath('/admin/objednavky')

  if (!statusChanged) return {}

  const emailResult = await dispatchStatusEmail(orderId, data.status, user.id)
  return { emailResult }
}

// ─── deleteOrder ─────────────────────────────────────────────────

export async function deleteOrder(orderId: string) {
  const { user } = await requireAuth()

  if (user.role === 'STAFF') {
    throw new Error('Obsluha nemá oprávnění mazat objednávky.')
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  })
  if (!order) throw new Error('Objednávka nenalezena.')
  if (order.status !== 'CANCELLED') {
    throw new Error('Lze smazat pouze stornovanou objednávku.')
  }

  await prisma.order.delete({ where: { id: orderId } })
  redirect('/admin/objednavky')
}

// ─── updateOrderItem ──────────────────────────────────────────────

export interface UpdateOrderItemData {
  quantity: number
  actualWeightKg: number | null
  unitPriceWithVat: number
  vatRate: number
  discount: number
  itemNote: string | null
}

export async function updateOrderItem(itemId: string, data: UpdateOrderItemData) {
  const { user } = await requireAuth()

  // Validate inputs
  if (data.quantity <= 0) throw new Error('Množství musí být větší než 0.')
  if (data.unitPriceWithVat < 0) throw new Error('Cena nemůže být záporná.')
  if (![0, 12, 21].includes(data.vatRate)) throw new Error('Neplatná sazba DPH.')
  if (data.discount < 0 || data.discount > 100) throw new Error('Sleva musí být 0–100 %.')

  // Fetch item + order info + sibling items in one query
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: {
      orderId: true,
      unit: true,
      productName: true,
      order: {
        select: {
          shippingPriceWithVat: true,
          shippingPriceWithoutVat: true,
          paymentFeeWithVat: true,
          paymentFeeWithoutVat: true,
          discountAmount: true,
          items: {
            where: { id: { not: itemId } },
            select: { lineTotalWithVat: true, lineTotalWithoutVat: true },
          },
        },
      },
    },
  })
  if (!item) throw new Error('Položka nenalezena.')

  // Compute new line totals
  const isWeightUnit = ['KG', 'G_100', 'L', 'ML_100'].includes(item.unit)
  const effectiveActualWeight = isWeightUnit ? data.actualWeightKg : null

  let grossLineWithVat: number
  if (effectiveActualWeight !== null) {
    grossLineWithVat = calculateWeightBasedPrice(
      data.unitPriceWithVat,
      item.unit as Parameters<typeof calculateWeightBasedPrice>[1],
      effectiveActualWeight,
    )
  } else {
    grossLineWithVat = roundMoney(data.unitPriceWithVat * data.quantity)
  }

  const discountFactor = 1 - data.discount / 100
  const lineTotalWithVat = roundMoney(grossLineWithVat * discountFactor)
  const lineTotalWithoutVat = priceWithoutVat(lineTotalWithVat, data.vatRate)
  const lineVatAmount = roundMoney(lineTotalWithVat - lineTotalWithoutVat)
  const unitPriceWithoutVat = priceWithoutVat(data.unitPriceWithVat, data.vatRate)

  // Recompute order totals
  const siblings = item.order.items
  const newSubtotalWithVat = roundMoney(
    siblings.reduce((s, i) => s + Number(i.lineTotalWithVat), 0) + lineTotalWithVat,
  )
  const newSubtotalWithoutVat = roundMoney(
    siblings.reduce((s, i) => s + Number(i.lineTotalWithoutVat), 0) + lineTotalWithoutVat,
  )
  const o = item.order
  const newTotalWithVat = roundMoney(
    newSubtotalWithVat +
      Number(o.shippingPriceWithVat) +
      Number(o.paymentFeeWithVat) -
      Number(o.discountAmount),
  )
  const newTotalWithoutVat = roundMoney(
    newSubtotalWithoutVat +
      Number(o.shippingPriceWithoutVat) +
      Number(o.paymentFeeWithoutVat) -
      Number(o.discountAmount),
  )
  const newTotalVat = roundMoney(newTotalWithVat - newTotalWithoutVat)

  await prisma.$transaction([
    prisma.orderItem.update({
      where: { id: itemId },
      data: {
        quantity: data.quantity,
        actualWeightKg: effectiveActualWeight,
        isWeightAdjusted: effectiveActualWeight !== null,
        unitPriceWithVat: data.unitPriceWithVat,
        unitPriceWithoutVat,
        vatRate: data.vatRate,
        discount: data.discount,
        itemNote: data.itemNote,
        lineTotalWithVat,
        lineTotalWithoutVat,
        lineVatAmount,
      },
    }),
    prisma.order.update({
      where: { id: item.orderId },
      data: {
        subtotalWithVat: newSubtotalWithVat,
        subtotalWithoutVat: newSubtotalWithoutVat,
        totalVat: newTotalVat,
        totalWithVat: newTotalWithVat,
        totalWithoutVat: newTotalWithoutVat,
      },
    }),
    prisma.orderNote.create({
      data: {
        orderId: item.orderId,
        content: `Upravena položka: ${item.productName}.`,
        createdBy: user.id,
      },
    }),
  ])

  revalidatePath(`/admin/objednavky/${item.orderId}`)
}

// ─── deleteOrderItem ──────────────────────────────────────────────

export async function deleteOrderItem(itemId: string) {
  const { user } = await requireAuth()

  if (user.role === 'STAFF') {
    throw new Error('Obsluha nemůže mazat položky objednávky.')
  }

  // Fetch item + full order items list
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: {
      orderId: true,
      productName: true,
      quantity: true,
      order: {
        select: {
          status: true,
          shippingPriceWithVat: true,
          shippingPriceWithoutVat: true,
          paymentFeeWithVat: true,
          paymentFeeWithoutVat: true,
          discountAmount: true,
          items: {
            select: { id: true, lineTotalWithVat: true, lineTotalWithoutVat: true },
          },
        },
      },
    },
  })
  if (!item) throw new Error('Položka nenalezena.')

  const { status, items: allItems } = item.order

  if (['SHIPPED', 'DELIVERED', 'REFUNDED'].includes(status)) {
    throw new Error('Nelze mazat položky odeslané nebo doručené objednávky.')
  }
  if (allItems.length <= 1) {
    throw new Error('Nelze odstranit poslední položku. Stornujte objednávku.')
  }

  // Siblings after deletion
  const siblings = allItems.filter((i) => i.id !== itemId)
  const newSubtotalWithVat = roundMoney(
    siblings.reduce((s, i) => s + Number(i.lineTotalWithVat), 0),
  )
  const newSubtotalWithoutVat = roundMoney(
    siblings.reduce((s, i) => s + Number(i.lineTotalWithoutVat), 0),
  )
  const o = item.order
  const newTotalWithVat = roundMoney(
    newSubtotalWithVat +
      Number(o.shippingPriceWithVat) +
      Number(o.paymentFeeWithVat) -
      Number(o.discountAmount),
  )
  const newTotalWithoutVat = roundMoney(
    newSubtotalWithoutVat +
      Number(o.shippingPriceWithoutVat) +
      Number(o.paymentFeeWithoutVat) -
      Number(o.discountAmount),
  )
  const newTotalVat = roundMoney(newTotalWithVat - newTotalWithoutVat)

  await prisma.$transaction([
    prisma.orderItem.delete({ where: { id: itemId } }),
    prisma.order.update({
      where: { id: item.orderId },
      data: {
        subtotalWithVat: newSubtotalWithVat,
        subtotalWithoutVat: newSubtotalWithoutVat,
        totalVat: newTotalVat,
        totalWithVat: newTotalWithVat,
        totalWithoutVat: newTotalWithoutVat,
      },
    }),
    prisma.orderNote.create({
      data: {
        orderId: item.orderId,
        content: `Odstraněna položka: ${item.productName} (${item.quantity}×).`,
        createdBy: user.id,
      },
    }),
  ])

  revalidatePath(`/admin/objednavky/${item.orderId}`)
}
