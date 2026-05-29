import path from 'path'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail, resolveRecipient } from '@/lib/email'
import { renderOrderStatusEmail } from '@/lib/order-email'
import { createInvoiceForOrder } from '@/lib/create-invoice'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-markes.jpg')
const LOGO_ATTACHMENT = {
  filename: 'logo-markes.jpg',
  path: LOGO_PATH,
  cid: 'logo-markes',
  contentType: 'image/jpeg',
}

export type StatusEmailResult = {
  attempted: boolean
  sent: boolean
  recipient: string | null
  error: string | null
  testMode: boolean
  invoiceGenerated: boolean
  invoiceAttached: boolean
  invoiceNumber: string | null
}

const NO_EMAIL: StatusEmailResult = {
  attempted: false, sent: false, recipient: null, error: null, testMode: false,
  invoiceGenerated: false, invoiceAttached: false, invoiceNumber: null,
}

// ─── Invoice handling ─────────────────────────────────────────────

async function handleInvoice(
  orderId: string,
  adminUserId: string,
  attachInvoice: boolean,
): Promise<{
  documentId: string | null
  number: string | null
  generated: boolean
  pdfBuffer: Buffer | null
}> {
  let documentId: string | null = null
  let invoiceNumber: string | null = null
  let generated = false
  let pdfBuffer: Buffer | null = null

  try {
    const result = await createInvoiceForOrder(orderId, 'Systém')
    documentId = result.documentId
    invoiceNumber = result.number
    generated = result.created

    await prisma.orderNote.create({
      data: {
        orderId,
        content: generated
          ? `Automaticky vystavena faktura ${invoiceNumber}.`
          : `Použita existující faktura ${invoiceNumber}.`,
        createdBy: adminUserId,
      },
    }).catch(() => {})
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[dispatch] faktura selhal:', msg)
    await prisma.orderNote.create({
      data: {
        orderId,
        content: `Automatické vystavení faktury selhalo: ${msg}`,
        createdBy: adminUserId,
      },
    }).catch(() => {})
  }

  if (documentId && attachInvoice) {
    try {
      pdfBuffer = await generateInvoicePdfBuffer(documentId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[dispatch] PDF selhal:', msg)
      await prisma.orderNote.create({
        data: {
          orderId,
          content: `PDF faktury ${invoiceNumber} se nepodařilo vygenerovat, email odeslán bez přílohy: ${msg}`,
          createdBy: adminUserId,
        },
      }).catch(() => {})
    }
  }

  return { documentId, number: invoiceNumber, generated, pdfBuffer }
}

// ─── Main dispatch ────────────────────────────────────────────────

export async function dispatchStatusEmail(
  orderId: string,
  newStatus: OrderStatus,
  adminUserId: string,
): Promise<StatusEmailResult> {
  const [config, order, branch, brandDb] = await Promise.all([
    prisma.orderStatusConfig.findUnique({ where: { status: newStatus } }),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        contactEmail: true,
        contactFirstName: true,
        contactLastName: true,
        customerId: true,
        totalWithVat: true,
        trackingNumber: true,
        trackingUrl: true,
        items: {
          select: {
            productName: true, variantName: true,
            quantity: true, unit: true, lineTotalWithVat: true,
          },
        },
      },
    }),
    prisma.branchSettings.findFirst({
      select: { name: true, street: true, zip: true, city: true, email: true, phone1: true, openingHours: true },
    }),
    prisma.brandSettings.findFirst({ select: { primaryColor: true, darkColor: true } }),
  ])

  if (!order) return NO_EMAIL

  // ── Faktura (nezávisle na emailu) ──────────────────────────────
  let invoiceDocumentId: string | null = null
  let invoiceNumber: string | null = null
  let invoiceGenerated = false
  let pdfBuffer: Buffer | null = null

  if (config?.generateInvoice) {
    const inv = await handleInvoice(orderId, adminUserId, config.attachInvoice ?? false)
    invoiceDocumentId = inv.documentId
    invoiceNumber = inv.number
    invoiceGenerated = inv.generated
    pdfBuffer = inv.pdfBuffer
  }

  // ── Email ──────────────────────────────────────────────────────
  if (!config?.sendEmail || !order.contactEmail) {
    return {
      ...NO_EMAIL,
      invoiceGenerated,
      invoiceNumber,
      invoiceAttached: false,
    }
  }

  const testMode = process.env.EMAIL_TEST_MODE !== 'false'

  try {
    const brand = brandDb
      ? { primary: brandDb.primaryColor, dark: brandDb.darkColor }
      : null

    const { subject, html } = renderOrderStatusEmail(config, {
      orderNumber: order.orderNumber,
      contactFirstName: order.contactFirstName,
      contactLastName: order.contactLastName,
      totalWithVat: order.totalWithVat.toNumber(),
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      items: order.items.map((i) => ({
        productName: i.productName, variantName: i.variantName,
        quantity: i.quantity, unit: i.unit,
        lineTotalWithVat: i.lineTotalWithVat.toNumber(),
      })),
    }, branch, brand)

    const resolved = resolveRecipient(order.contactEmail, subject)

    const attachments = [
      LOGO_ATTACHMENT,
      ...(pdfBuffer && invoiceNumber
        ? [{ filename: `faktura-${invoiceNumber.replace(/[^a-zA-Z0-9\-_]/g, '-')}.pdf`, content: pdfBuffer }]
        : []),
    ]

    const result = await sendEmail({
      to: resolved.to,
      subject: resolved.subject,
      html,
      attachments,
    })

    const invoiceAttached = result.success && attachments.length > 0

    await Promise.all([
      prisma.emailLog.create({
        data: {
          orderId,
          customerId: order.customerId,
          recipient: resolved.to,
          subject: resolved.subject,
          status: result.success ? 'sent' : 'failed',
          error: result.error ?? null,
        },
      }),
      prisma.orderNote.create({
        data: {
          orderId,
          content: result.success
            ? `Odeslán email zákazníkovi: ${resolved.subject}${invoiceAttached ? ` (příloha: faktura ${invoiceNumber})` : ''}`
            : `Email se nepodařilo odeslat: ${result.error ?? 'neznámá chyba'}`,
          createdBy: adminUserId,
        },
      }),
    ]).catch(() => {})

    return {
      attempted: true,
      sent: result.success,
      recipient: resolved.to,
      error: result.error ?? null,
      testMode,
      invoiceGenerated,
      invoiceAttached,
      invoiceNumber,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[dispatch-status-email] chyba:', msg)
    await prisma.orderNote.create({
      data: {
        orderId,
        content: `Email se nepodařilo odeslat (systémová chyba): ${msg}`,
        createdBy: adminUserId,
      },
    }).catch(() => {})
    return {
      attempted: true, sent: false, recipient: null, error: msg, testMode,
      invoiceGenerated, invoiceAttached: false, invoiceNumber,
    }
  }
}
