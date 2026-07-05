// Návrat z PayPalu po schválení platby. Redirectu se NEVĚŘÍ — platba se
// server-to-server CAPTURUJE a částka se ověří proti objednávce v DB.
// Idempotentní: opakované otevření URL (refresh) platbu nestrhne dvakrát
// (PayPal-Request-Id + ORDER_ALREADY_CAPTURED fallback + kontrola PAID).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { capturePayPalOrder, paypalCurrency } from '@/lib/paypal'
import { sendOrderConfirmationEmail } from '@/lib/order-confirmation-email'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  // PayPal posílá ?token=<paypalOrderId>
  const paypalOrderId = req.nextUrl.searchParams.get('token')

  if (!paypalOrderId) {
    return NextResponse.redirect(`${origin}/pokladna?platba=chyba`)
  }

  const order = await prisma.order.findUnique({
    where: { paypalOrderId },
    select: {
      id: true,
      orderNumber: true,
      publicToken: true,
      paymentStatus: true,
      totalWithVat: true,
    },
  })
  if (!order) {
    return NextResponse.redirect(`${origin}/pokladna?platba=chyba`)
  }

  const thankYouUrl = `${origin}/pokladna/dekujeme?t=${order.publicToken}&zaplaceno=1`

  // Už zaplaceno (např. refresh návratové stránky) → rovnou poděkovat
  if (order.paymentStatus === 'PAID') {
    return NextResponse.redirect(thankYouUrl)
  }

  try {
    const capture = await capturePayPalOrder(paypalOrderId)

    if (capture.status !== 'COMPLETED') {
      await note(order.id, `PayPal platba nedokončena (stav ${capture.status}).`)
      return NextResponse.redirect(`${origin}/pokladna?platba=neuspesna`)
    }

    // Ověření částky a měny proti DB — brána musí strhnout přesně tolik,
    // kolik říká objednávka
    const expected = Number(order.totalWithVat)
    if (
      capture.amount === null ||
      Math.abs(capture.amount - expected) > 0.01 ||
      (capture.currency && capture.currency !== paypalCurrency())
    ) {
      await note(
        order.id,
        `POZOR: nesoulad částky PayPal platby — očekáváno ${expected} ${paypalCurrency()}, strženo ${capture.amount} ${capture.currency}. Objednávka NEoznačena jako zaplacená, prověřte ručně.`,
      )
      return NextResponse.redirect(`${origin}/pokladna?platba=chyba`)
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        paidAt: new Date(),
        paymentTransactionId: capture.captureId,
      },
    })
    await note(
      order.id,
      `Zaplaceno přes PayPal (order ${paypalOrderId}, transakce ${capture.captureId ?? '—'}, ${capture.amount} ${capture.currency}).`,
    )

    // Potvrzovací e-mail až po úspěšné platbě
    await sendOrderConfirmationEmail(order.id).catch((err) => {
      console.error('[paypal/return] potvrzovací email selhal:', err)
    })

    return NextResponse.redirect(thankYouUrl)
  } catch (err) {
    console.error('[paypal/return] capture selhal:', err)
    await note(
      order.id,
      `PayPal capture selhal: ${err instanceof Error ? err.message : String(err)}. Objednávka zůstává „čeká na platbu".`,
    )
    return NextResponse.redirect(`${origin}/pokladna?platba=neuspesna`)
  }
}

async function note(orderId: string, content: string) {
  await prisma.orderNote.create({ data: { orderId, content } }).catch(() => {})
}
