import { DocumentType, DocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateDocumentNumber } from '@/lib/document-numbering'
import { roundMoney } from '@/lib/pricing'

const UNIT_LABELS: Record<string, string> = {
  KS: 'ks', KG: 'kg', G_100: '100 g', L: 'l', ML_100: '100 ml',
}

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
  let subtotalWithoutVat = 0, totalVat = 0, totalWithVat = 0
  for (const item of items) {
    subtotalWithoutVat = roundMoney(subtotalWithoutVat + item.lineTotalWithoutVat)
    totalVat = roundMoney(totalVat + item.lineVatAmount)
    totalWithVat = roundMoney(totalWithVat + item.lineTotalWithVat)
  }
  return { subtotalWithoutVat, totalVat, totalWithVat }
}

export type CreateInvoiceResult = {
  documentId: string
  number: string
  created: boolean // false = existující faktura, true = nově vytvořená
}

// Čistá logika bez requireAuth — volatelná z lib (automatizace, server)
export async function createInvoiceForOrder(
  orderId: string,
  createdByLabel: string, // "Systém" nebo "Jméno Příjmení"
): Promise<CreateInvoiceResult> {
  // Vrať existující fakturu pokud existuje
  const existing = await prisma.document.findFirst({
    where: { orderId, type: DocumentType.INVOICE },
    select: { id: true, number: true },
  })
  if (existing) return { documentId: existing.id, number: existing.number, created: false }

  const [supplier, order] = await Promise.all([
    prisma.supplierSettings.findFirst(),
    prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { id: 'asc' } } },
    }),
  ])
  if (!supplier) throw new Error('Nejdřív vyplňte údaje dodavatele v Nastavení.')
  if (!order) throw new Error('Objednávka nenalezena.')

  const invoiceNumber = await generateDocumentNumber('INVOICE')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + (supplier.defaultDueDays ?? 14))

  const billing = ((order.billingAddressSnapshot ?? order.shippingAddressSnapshot) ?? {}) as Record<string, string>
  const customerName =
    order.isBusinessOrder && order.companyName
      ? order.companyName
      : `${order.contactFirstName} ${order.contactLastName}`.trim()

  const pricesIncludeVat = !order.isBusinessOrder

  type NormItem = {
    description: string; quantity: number; unit: string
    unitPriceWithVat: number; unitPriceWithoutVat: number; vatRate: number
    discount: number | null
    lineTotalWithVat: number; lineTotalWithoutVat: number; lineVatAmount: number
    sortOrder: number
  }

  const normItems: NormItem[] = order.items.map((item, idx) => {
    const vatRate = Math.round(Number(item.vatRate))
    const lineTotalWithVat = Number(item.lineTotalWithVat)
    const description = item.variantName
      ? `${item.productName} – ${item.variantName}`
      : item.productName

    if (item.actualWeightKg != null) {
      const kg = Number(item.actualWeightKg)
      const ltWithoutVat = roundMoney(lineTotalWithVat / (1 + vatRate / 100))
      const ltVat = roundMoney(lineTotalWithVat - ltWithoutVat)
      return {
        description, quantity: kg, unit: 'kg',
        unitPriceWithVat: kg > 0 ? roundMoney(lineTotalWithVat / kg) : Number(item.unitPriceWithVat),
        unitPriceWithoutVat: kg > 0 ? roundMoney(ltWithoutVat / kg) : Number(item.unitPriceWithoutVat),
        vatRate, discount: null,
        lineTotalWithVat, lineTotalWithoutVat: ltWithoutVat, lineVatAmount: ltVat,
        sortOrder: idx,
      }
    }

    const ltWithoutVat = Number(item.lineTotalWithoutVat)
    return {
      description, quantity: item.quantity,
      unit: UNIT_LABELS[item.unit as string] ?? String(item.unit),
      unitPriceWithVat: Number(item.unitPriceWithVat),
      unitPriceWithoutVat: Number(item.unitPriceWithoutVat),
      vatRate, discount: item.discount != null ? Number(item.discount) : null,
      lineTotalWithVat, lineTotalWithoutVat: ltWithoutVat,
      lineVatAmount: roundMoney(lineTotalWithVat - ltWithoutVat),
      sortOrder: idx,
    }
  })

  let nextSort = normItems.length
  if (Number(order.shippingPriceWithVat) > 0) {
    const ltWithVat = Number(order.shippingPriceWithVat)
    const vatRate = 21
    const ltWithoutVat = roundMoney(ltWithVat / (1 + vatRate / 100))
    normItems.push({
      description: order.shippingMethodName || 'Doprava', quantity: 1, unit: 'ks',
      unitPriceWithVat: ltWithVat, unitPriceWithoutVat: ltWithoutVat, vatRate, discount: null,
      lineTotalWithVat: ltWithVat, lineTotalWithoutVat: ltWithoutVat,
      lineVatAmount: roundMoney(ltWithVat - ltWithoutVat), sortOrder: nextSort++,
    })
  }
  if (Number(order.paymentFeeWithVat) > 0) {
    const ltWithVat = Number(order.paymentFeeWithVat)
    const vatRate = 21
    const ltWithoutVat = roundMoney(ltWithVat / (1 + vatRate / 100))
    normItems.push({
      description: order.paymentMethodName || 'Platební poplatek', quantity: 1, unit: 'ks',
      unitPriceWithVat: ltWithVat, unitPriceWithoutVat: ltWithoutVat, vatRate, discount: null,
      lineTotalWithVat: ltWithVat, lineTotalWithoutVat: ltWithoutVat,
      lineVatAmount: roundMoney(ltWithVat - ltWithoutVat), sortOrder: nextSort++,
    })
  }

  const totals = sumTotals(normItems)
  const vatBreakdown = buildVatBreakdown(normItems)

  const doc = await prisma.document.create({
    data: {
      type: DocumentType.INVOICE,
      status: DocumentStatus.VALID,
      number: invoiceNumber,
      orderId,
      customerId: order.customerId,
      supplierName: supplier.companyName,
      supplierStreet: supplier.street,
      supplierCity: supplier.city,
      supplierPostalCode: supplier.postalCode,
      supplierCountry: supplier.country,
      supplierCompanyId: supplier.companyId,
      supplierVatId: supplier.vatId,
      supplierBankAccount: supplier.bankAccount,
      supplierLegalNote: supplier.legalNote,
      customerName,
      customerStreet: billing.street ?? null,
      customerCity: billing.city ?? null,
      customerPostalCode: billing.postalCode ?? null,
      customerCountry: billing.country ?? null,
      customerCompanyId: order.isBusinessOrder ? order.companyId ?? null : null,
      customerVatId: order.isBusinessOrder ? order.vatId ?? null : null,
      customerEmail: order.contactEmail,
      customerPhone: order.contactPhone,
      issueDate: today,
      dueDate,
      taxDate: today,
      variableSymbol: invoiceNumber,
      paymentMethod: order.paymentMethodName,
      pricesIncludeVat,
      subtotalWithoutVat: totals.subtotalWithoutVat,
      totalVat: totals.totalVat,
      totalWithVat: totals.totalWithVat,
      vatBreakdown,
      createdBy: createdByLabel,
      items: {
        create: normItems.map((item) => ({
          description: item.description, quantity: item.quantity, unit: item.unit,
          unitPriceWithVat: item.unitPriceWithVat, unitPriceWithoutVat: item.unitPriceWithoutVat,
          vatRate: item.vatRate, discount: item.discount,
          lineTotalWithVat: item.lineTotalWithVat, lineTotalWithoutVat: item.lineTotalWithoutVat,
          lineVatAmount: item.lineVatAmount, sortOrder: item.sortOrder,
        })),
      },
    },
    select: { id: true, number: true },
  })

  return { documentId: doc.id, number: doc.number, created: true }
}
