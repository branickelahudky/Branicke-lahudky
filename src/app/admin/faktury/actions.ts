'use server'

import { revalidatePath } from 'next/cache'
import { DocumentStatus, DocumentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { peekDocumentNumber } from '@/lib/document-numbering'
import { roundMoney } from '@/lib/pricing'

export { peekDocumentNumber }

const UNIT_LABELS: Record<string, string> = {
  KS: 'ks', KG: 'kg', G_100: '100 g', L: 'l', ML_100: '100 ml',
}

// ─── Types ────────────────────────────────────────────────────────

export type CreateInvoiceData = {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  taxDate: string
  paymentMethod: string
  variableSymbol: string
  pricesIncludeVat: boolean
}

export type UpdateInvoiceItemData = {
  id: string
  quantity: number
  unitPriceWithVat: number
  vatRate: number
  discount: number | null
}

export type UpdateInvoiceData = {
  number: string
  status: DocumentStatus
  issueDate: string
  dueDate: string
  taxDate: string
  variableSymbol: string
  constantSymbol: string | null
  specificSymbol: string | null
  paymentMethod: string
  note: string | null
  internalNote: string | null
  items: UpdateInvoiceItemData[]
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildVatBreakdown(
  items: Array<{ lineTotalWithoutVat: number; lineVatAmount: number; vatRate: number }>,
) {
  const bd: Record<number, { rate: number; base: number; vat: number }> = {}
  for (const item of items) {
    bd[item.vatRate] ??= { rate: item.vatRate, base: 0, vat: 0 }
    bd[item.vatRate].base = roundMoney(bd[item.vatRate].base + item.lineTotalWithoutVat)
    bd[item.vatRate].vat = roundMoney(bd[item.vatRate].vat + item.lineVatAmount)
  }
  return Object.values(bd)
}

function sumTotals(
  items: Array<{ lineTotalWithoutVat: number; lineVatAmount: number; lineTotalWithVat: number }>,
) {
  let subtotalWithoutVat = 0
  let totalVat = 0
  let totalWithVat = 0
  for (const item of items) {
    subtotalWithoutVat = roundMoney(subtotalWithoutVat + item.lineTotalWithoutVat)
    totalVat = roundMoney(totalVat + item.lineVatAmount)
    totalWithVat = roundMoney(totalWithVat + item.lineTotalWithVat)
  }
  return { subtotalWithoutVat, totalVat, totalWithVat }
}

// ─── createInvoiceFromOrder ───────────────────────────────────────

export async function createInvoiceFromOrder(
  orderId: string,
  data: CreateInvoiceData,
): Promise<{ documentId: string }> {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  const supplier = await prisma.supplierSettings.findFirst()
  if (!supplier) throw new Error('Nejdřív vyplňte údaje dodavatele v Nastavení.')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: 'asc' } } },
  })
  if (!order) throw new Error('Objednávka nenalezena.')

  const existing = await prisma.document.findFirst({
    where: { orderId, type: DocumentType.INVOICE },
    select: { id: true },
  })
  if (existing) throw new Error('Pro tuto objednávku již faktura existuje.')

  const numTrimmed = data.invoiceNumber.trim()
  if (!numTrimmed) throw new Error('Číslo faktury je povinné.')
  const dupNum = await prisma.document.findFirst({
    where: { number: numTrimmed },
    select: { id: true },
  })
  if (dupNum) throw new Error(`Číslo faktury „${numTrimmed}" je již použito.`)

  // Customer snapshot
  const billing = ((order.billingAddressSnapshot ?? order.shippingAddressSnapshot) ?? {}) as Record<string, string>
  const customerName =
    order.isBusinessOrder && order.companyName
      ? order.companyName
      : `${order.contactFirstName} ${order.contactLastName}`.trim()

  // Normalize OrderItems → invoice line items
  type NormItem = {
    description: string
    quantity: number
    unit: string
    unitPriceWithVat: number
    unitPriceWithoutVat: number
    vatRate: number
    discount: number | null
    lineTotalWithVat: number
    lineTotalWithoutVat: number
    lineVatAmount: number
    sortOrder: number
  }

  const normItems: NormItem[] = order.items.map((item, idx) => {
    const vatRate = Math.round(Number(item.vatRate))
    const lineTotalWithVat = Number(item.lineTotalWithVat)
    const description = item.variantName
      ? `${item.productName} – ${item.variantName}`
      : item.productName

    if (item.actualWeightKg != null) {
      // Weight-based: normalize to kg, derive unit price from stored total
      const kg = Number(item.actualWeightKg)
      const ltWithoutVat = roundMoney(lineTotalWithVat / (1 + vatRate / 100))
      const ltVat = roundMoney(lineTotalWithVat - ltWithoutVat)
      const upWithVat = kg > 0 ? roundMoney(lineTotalWithVat / kg) : Number(item.unitPriceWithVat)
      const upWithoutVat = kg > 0 ? roundMoney(ltWithoutVat / kg) : Number(item.unitPriceWithoutVat)
      return {
        description,
        quantity: kg,
        unit: 'kg',
        unitPriceWithVat: upWithVat,
        unitPriceWithoutVat: upWithoutVat,
        vatRate,
        discount: null,
        lineTotalWithVat,
        lineTotalWithoutVat: ltWithoutVat,
        lineVatAmount: ltVat,
        sortOrder: idx,
      }
    }

    const ltWithoutVat = Number(item.lineTotalWithoutVat)
    const ltVat = roundMoney(lineTotalWithVat - ltWithoutVat)
    return {
      description,
      quantity: item.quantity,
      unit: UNIT_LABELS[item.unit as string] ?? String(item.unit),
      unitPriceWithVat: Number(item.unitPriceWithVat),
      unitPriceWithoutVat: Number(item.unitPriceWithoutVat),
      vatRate,
      discount: item.discount != null ? Number(item.discount) : null,
      lineTotalWithVat,
      lineTotalWithoutVat: ltWithoutVat,
      lineVatAmount: ltVat,
      sortOrder: idx,
    }
  })

  let nextSort = normItems.length

  // Shipping as line item
  if (Number(order.shippingPriceWithVat) > 0) {
    const ltWithVat = Number(order.shippingPriceWithVat)
    const vatRate = 21
    const ltWithoutVat = roundMoney(ltWithVat / (1 + vatRate / 100))
    normItems.push({
      description: order.shippingMethodName || 'Doprava',
      quantity: 1,
      unit: 'ks',
      unitPriceWithVat: ltWithVat,
      unitPriceWithoutVat: ltWithoutVat,
      vatRate,
      discount: null,
      lineTotalWithVat: ltWithVat,
      lineTotalWithoutVat: ltWithoutVat,
      lineVatAmount: roundMoney(ltWithVat - ltWithoutVat),
      sortOrder: nextSort++,
    })
  }

  // Payment fee as line item
  if (Number(order.paymentFeeWithVat) > 0) {
    const ltWithVat = Number(order.paymentFeeWithVat)
    const vatRate = 21
    const ltWithoutVat = roundMoney(ltWithVat / (1 + vatRate / 100))
    normItems.push({
      description: order.paymentMethodName || 'Platební poplatek',
      quantity: 1,
      unit: 'ks',
      unitPriceWithVat: ltWithVat,
      unitPriceWithoutVat: ltWithoutVat,
      vatRate,
      discount: null,
      lineTotalWithVat: ltWithVat,
      lineTotalWithoutVat: ltWithoutVat,
      lineVatAmount: roundMoney(ltWithVat - ltWithoutVat),
      sortOrder: nextSort++,
    })
  }

  const totals = sumTotals(normItems)
  const vatBreakdown = buildVatBreakdown(normItems)

  const doc = await prisma.document.create({
    data: {
      type: DocumentType.INVOICE,
      status: DocumentStatus.VALID,
      number: numTrimmed,
      orderId,
      customerId: order.customerId,
      // Supplier snapshot
      supplierName: supplier.companyName,
      supplierStreet: supplier.street,
      supplierCity: supplier.city,
      supplierPostalCode: supplier.postalCode,
      supplierCountry: supplier.country,
      supplierCompanyId: supplier.companyId,
      supplierVatId: supplier.vatId,
      supplierBankAccount: supplier.bankAccount,
      supplierLegalNote: supplier.legalNote,
      // Customer snapshot
      customerName,
      customerStreet: billing.street ?? null,
      customerCity: billing.city ?? null,
      customerPostalCode: billing.postalCode ?? null,
      customerCountry: billing.country ?? null,
      customerCompanyId: order.isBusinessOrder ? order.companyId ?? null : null,
      customerVatId: order.isBusinessOrder ? order.vatId ?? null : null,
      customerEmail: order.contactEmail,
      customerPhone: order.contactPhone,
      // Dates
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      taxDate: new Date(data.taxDate),
      // Payment
      variableSymbol: data.variableSymbol,
      paymentMethod: data.paymentMethod,
      // Price mode
      pricesIncludeVat: data.pricesIncludeVat,
      // Totals
      subtotalWithoutVat: totals.subtotalWithoutVat,
      totalVat: totals.totalVat,
      totalWithVat: totals.totalWithVat,
      vatBreakdown,
      // Meta
      createdBy: `${user.firstName} ${user.lastName}`,
      items: {
        create: normItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceWithVat: item.unitPriceWithVat,
          unitPriceWithoutVat: item.unitPriceWithoutVat,
          vatRate: item.vatRate,
          discount: item.discount,
          lineTotalWithVat: item.lineTotalWithVat,
          lineTotalWithoutVat: item.lineTotalWithoutVat,
          lineVatAmount: item.lineVatAmount,
          sortOrder: item.sortOrder,
        })),
      },
    },
    select: { id: true },
  })

  revalidatePath('/admin/faktury')
  revalidatePath(`/admin/objednavky/${orderId}`)
  return { documentId: doc.id }
}

// ─── updateInvoice ────────────────────────────────────────────────

export async function updateInvoice(documentId: string, data: UpdateInvoiceData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, orderId: true },
  })
  if (!doc) throw new Error('Faktura nenalezena.')

  const numTrimmed = data.number.trim()
  if (!numTrimmed) throw new Error('Číslo faktury je povinné.')
  const dup = await prisma.document.findFirst({
    where: { number: numTrimmed, id: { not: documentId } },
    select: { id: true },
  })
  if (dup) throw new Error(`Číslo faktury „${numTrimmed}" je již použito.`)

  // Recalculate items
  const recalced = data.items.map((item) => {
    const discountFactor = item.discount ? 1 - item.discount / 100 : 1
    const lineTotalWithVat = roundMoney(item.quantity * item.unitPriceWithVat * discountFactor)
    const lineTotalWithoutVat = roundMoney(lineTotalWithVat / (1 + item.vatRate / 100))
    const lineVatAmount = roundMoney(lineTotalWithVat - lineTotalWithoutVat)
    const unitPriceWithoutVat = roundMoney(item.unitPriceWithVat / (1 + item.vatRate / 100))
    return { ...item, lineTotalWithVat, lineTotalWithoutVat, lineVatAmount, unitPriceWithoutVat }
  })

  const totals = sumTotals(recalced)
  const vatBreakdown = buildVatBreakdown(recalced)

  await prisma.$transaction([
    prisma.document.update({
      where: { id: documentId },
      data: {
        number: numTrimmed,
        status: data.status,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        taxDate: new Date(data.taxDate),
        variableSymbol: data.variableSymbol,
        constantSymbol: data.constantSymbol || null,
        specificSymbol: data.specificSymbol || null,
        paymentMethod: data.paymentMethod,
        note: data.note || null,
        internalNote: data.internalNote || null,
        subtotalWithoutVat: totals.subtotalWithoutVat,
        totalVat: totals.totalVat,
        totalWithVat: totals.totalWithVat,
        vatBreakdown,
      },
    }),
    ...recalced.map((item) =>
      prisma.documentItem.update({
        where: { id: item.id },
        data: {
          quantity: item.quantity,
          unitPriceWithVat: item.unitPriceWithVat,
          unitPriceWithoutVat: item.unitPriceWithoutVat,
          vatRate: item.vatRate,
          discount: item.discount,
          lineTotalWithVat: item.lineTotalWithVat,
          lineTotalWithoutVat: item.lineTotalWithoutVat,
          lineVatAmount: item.lineVatAmount,
        },
      }),
    ),
  ])

  revalidatePath('/admin/faktury')
  revalidatePath(`/admin/faktury/${documentId}`)
  if (doc.orderId) revalidatePath(`/admin/objednavky/${doc.orderId}`)
}

// ─── deleteInvoice ────────────────────────────────────────────────

export async function deleteInvoice(documentId: string) {
  const { user } = await requireAuth()
  if (user.role !== 'OWNER') throw new Error('Smazat fakturu může pouze majitel.')

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { orderId: true },
  })
  if (!doc) throw new Error('Faktura nenalezena.')

  await prisma.document.delete({ where: { id: documentId } })

  revalidatePath('/admin/faktury')
  if (doc.orderId) revalidatePath(`/admin/objednavky/${doc.orderId}`)
}
