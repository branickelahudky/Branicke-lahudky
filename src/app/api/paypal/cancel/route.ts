// Zákazník platbu na PayPalu zrušil — objednávka zůstává „čeká na platbu",
// košík v prohlížeči je nedotčený (vyprazdňuje se až po úspěšné platbě).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const paypalOrderId = req.nextUrl.searchParams.get('token')

  if (paypalOrderId) {
    const order = await prisma.order.findUnique({
      where: { paypalOrderId },
      select: { id: true },
    })
    if (order) {
      await prisma.orderNote.create({
        data: {
          orderId: order.id,
          content: 'Zákazník zrušil platbu na PayPalu — objednávka čeká na platbu.',
        },
      }).catch(() => {})
    }
  }

  return NextResponse.redirect(`${origin}/pokladna?platba=zrusena`)
}
