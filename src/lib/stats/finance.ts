import { prisma } from '@/lib/prisma'
import { pragueCurrentYear, pragueStartOfYear, pragueStartOfDay, pragueMonthOf } from './helpers'

export type VatBreakdownRow = {
  rate: number
  base: number
  vat: number
}

export type FinanceStats = {
  year: number
  totalInvoiced: number
  totalPaid: number
  totalOverdue: number
  byMonth: Array<{
    month: number
    invoiced: number
    paid: number
    invoiceCount: number
  }>
  vatByMonth: Array<{
    month: number
    base12: number; vat12: number
    base21: number; vat21: number
    totalVat: number
  }>
  unpaidInvoices: Array<{
    id: string
    number: string
    customerName: string
    totalWithVat: number
    dueDate: Date
    daysOverdue: number
  }>
}

export async function getFinanceStats(): Promise<FinanceStats> {
  const year = pragueCurrentYear()
  const yearStart = pragueStartOfYear(year)
  const yearEnd = pragueStartOfYear(year + 1)
  const now = new Date()

  const [yearInvoices, unpaidInvoices] = await Promise.all([
    prisma.document.findMany({
      where: { type: 'INVOICE', status: 'VALID', issueDate: { gte: yearStart, lt: yearEnd } },
      select: {
        id: true,
        number: true,
        customerName: true,
        totalWithVat: true,
        issueDate: true,
        dueDate: true,
        vatBreakdown: true,
        order: { select: { paymentStatus: true, paidAt: true } },
      },
    }),
    prisma.document.findMany({
      where: {
        type: 'INVOICE',
        status: 'VALID',
        dueDate: { lt: now },
        order: { paymentStatus: { not: 'PAID' } },
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        totalWithVat: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),
  ])

  // Monthly breakdown
  const byMonthMap = new Map<number, { invoiced: number; paid: number; count: number }>()
  for (let m = 1; m <= 12; m++) byMonthMap.set(m, { invoiced: 0, paid: 0, count: 0 })

  const vatByMonthMap = new Map<number, { base12: number; vat12: number; base21: number; vat21: number }>()
  for (let m = 1; m <= 12; m++) vatByMonthMap.set(m, { base12: 0, vat12: 0, base21: 0, vat21: 0 })

  let totalInvoiced = 0, totalPaid = 0

  for (const inv of yearInvoices) {
    const m = pragueMonthOf(inv.issueDate)
    const amount = Number(inv.totalWithVat)
    const isPaid = inv.order?.paymentStatus === 'PAID'

    totalInvoiced += amount
    if (isPaid) totalPaid += amount

    const e = byMonthMap.get(m)!
    e.invoiced += amount
    e.count += 1
    if (isPaid) e.paid += amount

    // VAT breakdown
    const vatBreakdown = inv.vatBreakdown as VatBreakdownRow[]
    if (Array.isArray(vatBreakdown)) {
      const ve = vatByMonthMap.get(m)!
      for (const row of vatBreakdown) {
        if (row.rate === 12 || row.rate === 12.0) {
          ve.base12 += Number(row.base)
          ve.vat12 += Number(row.vat)
        } else if (row.rate === 21 || row.rate === 21.0) {
          ve.base21 += Number(row.base)
          ve.vat21 += Number(row.vat)
        }
      }
    }
  }

  // Total overdue: invoices past due and unpaid
  const totalOverdue = unpaidInvoices.reduce((s, i) => s + Number(i.totalWithVat), 0)

  return {
    year,
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalOverdue: Math.round(totalOverdue * 100) / 100,
    byMonth: Array.from(byMonthMap.entries()).map(([month, v]) => ({
      month,
      invoiced: Math.round(v.invoiced * 100) / 100,
      paid: Math.round(v.paid * 100) / 100,
      invoiceCount: v.count,
    })),
    vatByMonth: Array.from(vatByMonthMap.entries()).map(([month, v]) => ({
      month,
      base12: Math.round(v.base12 * 100) / 100,
      vat12: Math.round(v.vat12 * 100) / 100,
      base21: Math.round(v.base21 * 100) / 100,
      vat21: Math.round(v.vat21 * 100) / 100,
      totalVat: Math.round((v.vat12 + v.vat21) * 100) / 100,
    })),
    unpaidInvoices: unpaidInvoices.map(i => ({
      id: i.id,
      number: i.number,
      customerName: i.customerName,
      totalWithVat: Number(i.totalWithVat),
      dueDate: i.dueDate,
      daysOverdue: Math.max(0, Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000)),
    })),
  }
}
