import { DocumentType } from '@prisma/client'
import { generateNextNumber, peekNextNumber } from './number-series'

const TYPE_TO_KEY: Partial<Record<DocumentType, string>> = {
  INVOICE: 'INVOICE',
  CREDIT_NOTE: 'CREDIT_NOTE',
  PROFORMA: 'PROFORMA',
  DELIVERY_NOTE: 'DELIVERY_NOTE',
}

/**
 * Atomicky vygeneruje číslo dokladu (zvýší čítač číselné řady).
 * Zachovává stávající signaturu pro zpětnou kompatibilitu.
 */
export async function generateDocumentNumber(
  type: DocumentType,
  _year?: number,
): Promise<string> {
  const key = TYPE_TO_KEY[type]
  if (key) return generateNextNumber(key)

  // PAYMENT_RECEIPT — bez vlastní řady, fallback na starý scan
  const { prisma } = await import('./prisma')
  const prefix = 'P'
  const year = _year ?? new Date().getFullYear()
  const startsWith = `${prefix}${year}-`
  const last = await prisma.document.findFirst({
    where: { type, number: { startsWith } },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  let next = 1
  if (last) {
    const seq = last.number.slice(startsWith.length)
    next = (parseInt(seq, 10) || 0) + 1
  }
  const pad = Math.max(2, String(next).length)
  return `${prefix}${year}-${String(next).padStart(pad, '0')}`
}

/**
 * Náhled příštího čísla BEZ zvýšení čítače (pro UI preview).
 */
export async function peekDocumentNumber(type: DocumentType): Promise<string> {
  const key = TYPE_TO_KEY[type]
  if (key) return peekNextNumber(key)
  return ''
}
