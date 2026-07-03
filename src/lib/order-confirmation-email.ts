// Potvrzovací e-mail zákazníkovi po vytvoření objednávky z pokladny.
// Texty lze přepsat v adminu (Nastavení → Stavy objednávek → PENDING),
// jinak se použijí výchozí. Respektuje EMAIL_TEST_MODE (viz resolveRecipient).

import path from 'path'
import { prisma } from '@/lib/prisma'
import { sendEmail, resolveRecipient } from '@/lib/email'
import {
  renderOrderConfirmationEmail,
  type OrderForConfirmationEmail,
} from '@/lib/order-email'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-markes.jpg')
const LOGO_ATTACHMENT = {
  filename: 'logo-markes.jpg',
  path: LOGO_PATH,
  cid: 'logo-markes',
  contentType: 'image/jpeg',
}

export type ConfirmationEmailResult = {
  attempted: boolean
  sent: boolean
  recipient: string | null
  error: string | null
  testMode: boolean
}

/** Platba převodem → v e-mailu ukážeme platební údaje (účet, VS, částku). */
function isBankTransfer(pm: { code: string; type: string | null } | null): boolean {
  if (!pm) return false
  return pm.type === 'transfer' || pm.code.toUpperCase().includes('TRANSFER')
}

export async function sendOrderConfirmationEmail(
  orderId: string,
): Promise<ConfirmationEmailResult> {
  const testMode = process.env.EMAIL_TEST_MODE !== 'false'

  const [order, config, branch, brandDb, supplier] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        contactEmail: true,
        contactFirstName: true,
        contactLastName: true,
        customerId: true,
        totalWithVat: true,
        subtotalWithVat: true,
        shippingMethodName: true,
        shippingPriceWithVat: true,
        paymentMethodName: true,
        paymentFeeWithVat: true,
        preferredDeliveryDate: true,
        deliveryTimeSlot: true,
        trackingNumber: true,
        trackingUrl: true,
        paymentMethod: { select: { code: true, type: true } },
        items: {
          select: {
            productName: true, variantName: true,
            quantity: true, unit: true, lineTotalWithVat: true,
          },
        },
      },
    }),
    prisma.orderStatusConfig.findUnique({
      where: { status: 'PENDING' },
      select: { emailSubject: true, emailHeading: true, emailBody: true },
    }),
    prisma.branchSettings.findFirst({
      select: { name: true, street: true, zip: true, city: true, email: true, phone1: true, openingHours: true },
    }),
    prisma.brandSettings.findFirst({ select: { primaryColor: true, darkColor: true } }),
    prisma.supplierSettings.findFirst({ select: { bankAccount: true, iban: true } }),
  ])

  if (!order || !order.contactEmail) {
    return { attempted: false, sent: false, recipient: null, error: null, testMode }
  }

  try {
    const orderForEmail: OrderForConfirmationEmail = {
      orderNumber: order.orderNumber,
      contactFirstName: order.contactFirstName,
      contactLastName: order.contactLastName,
      totalWithVat: order.totalWithVat.toNumber(),
      subtotalWithVat: order.subtotalWithVat.toNumber(),
      shippingMethodName: order.shippingMethodName,
      shippingPriceWithVat: order.shippingPriceWithVat.toNumber(),
      paymentMethodName: order.paymentMethodName,
      paymentFeeWithVat: order.paymentFeeWithVat.toNumber(),
      preferredDeliveryDate: order.preferredDeliveryDate,
      deliveryTimeSlot: order.deliveryTimeSlot,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      items: order.items.map((i) => ({
        productName: i.productName, variantName: i.variantName,
        quantity: i.quantity, unit: i.unit,
        lineTotalWithVat: i.lineTotalWithVat.toNumber(),
      })),
    }

    const { subject, html } = renderOrderConfirmationEmail(orderForEmail, {
      config,
      bank: supplier,
      showBankDetails: isBankTransfer(order.paymentMethod),
      branch,
      brand: brandDb ? { primary: brandDb.primaryColor, dark: brandDb.darkColor } : null,
    })

    const resolved = resolveRecipient(order.contactEmail, subject)

    const result = await sendEmail({
      to: resolved.to,
      subject: resolved.subject,
      html,
      attachments: [LOGO_ATTACHMENT],
    })

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
            ? `Odesláno potvrzení objednávky zákazníkovi: ${resolved.subject}`
            : `Potvrzení objednávky se nepodařilo odeslat: ${result.error ?? 'neznámá chyba'}`,
        },
      }),
    ]).catch(() => {})

    return {
      attempted: true,
      sent: result.success,
      recipient: resolved.to,
      error: result.error ?? null,
      testMode,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[order-confirmation-email] chyba:', msg)
    await prisma.orderNote.create({
      data: {
        orderId,
        content: `Potvrzení objednávky se nepodařilo odeslat (systémová chyba): ${msg}`,
      },
    }).catch(() => {})
    return { attempted: true, sent: false, recipient: null, error: msg, testMode }
  }
}
