// POST /api/orders - vytvoření objednávky
// GET /api/orders - seznam objednávek (admin)

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  calculateOrderTotals,
  activeSalePrice,
  priceWithoutVat as computePriceWithoutVat,
  type OrderLineInput,
} from '@/lib/pricing'
import { generateNextNumber } from '@/lib/number-series'
import { calculateCartWeightKg, resolveShippingPrice, type CartWeightItem } from '@/lib/cart-weight'
import { sendOrderConfirmationEmail } from '@/lib/order-confirmation-email'
import { createPayPalOrder, paypalConfigured } from '@/lib/paypal'
import { getSession } from '@/lib/auth'
import { getCustomerSession } from '@/lib/customer-auth'

const createOrderSchema = z.object({
  // Kontakt
  contactEmail: z.string().email(),
  contactPhone: z.string().min(9),
  contactFirstName: z.string().min(1),
  contactLastName: z.string().min(1),

  // B2B (volitelně)
  isBusinessOrder: z.boolean().default(false),
  companyName: z.string().optional(),
  companyId: z.string().optional(),
  vatId: z.string().optional(),

  // Položky
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),

  // Adresy
  shippingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    street: z.string(),
    city: z.string(),
    postalCode: z.string(),
    country: z.string().default('CZ'),
    phone: z.string().optional(),
    note: z.string().optional(),
  }),
  billingAddressSameAsShipping: z.boolean().default(true),
  billingAddress: z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      company: z.string().optional(),
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      country: z.string().default('CZ'),
    })
    .optional(),

  // Doprava + platba
  shippingMethodId: z.string(),
  paymentMethodId: z.string(),

  // Termín doručení
  preferredDeliveryDate: z.string().datetime().optional(),
  deliveryTimeSlot: z.string().optional(),
  deliveryNote: z.string().optional(),

  // Sleva
  discountCode: z.string().optional(),

  // Poznámka
  customerNote: z.string().optional(),
})

export async function POST(req: NextRequest) {
  let data: z.infer<typeof createOrderSchema>
  try {
    const body = await req.json()
    data = createOrderSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Formulář obsahuje neplatné údaje, zkontrolujte prosím vyplněná pole.', issues: err.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 })
  }

  // Přihlášenému zákazníkovi objednávku přiřadíme — z jeho session cookie,
  // nikdy z těla požadavku (to by šlo podvrhnout). Host = null.
  const customerSession = await getCustomerSession()
  const customerId = customerSession?.customer.id

  // Načteme produkty a varianty, abychom měli aktuální ceny (snapshot pro objednávku)
  const productIds = data.items.map((i) => i.productId)
  const variantIds = data.items.map((i) => i.variantId).filter((v): v is string => !!v)

  const [products, variants, shippingMethod, paymentMethod, discount] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { images: { where: { isPrimary: true }, take: 1 } },
    }),
    variantIds.length
      ? prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
      : Promise.resolve([]),
    prisma.shippingMethod.findUnique({
      where: { id: data.shippingMethodId },
      include: { weightTiers: { orderBy: { maxWeightKg: 'asc' } } },
    }),
    prisma.paymentMethod.findUnique({ where: { id: data.paymentMethodId } }),
    data.discountCode
      ? prisma.discountCode.findUnique({ where: { code: data.discountCode } })
      : Promise.resolve(null),
  ])

  if (!shippingMethod || !shippingMethod.isActive) {
    return NextResponse.json(
      { error: 'Zvolený způsob dopravy není dostupný.' },
      { status: 400 }
    )
  }
  // Doprava musí umět doručit do země adresy (ČR × Slovensko mají jiné metody)
  if (!shippingMethod.availableCountries.includes(data.shippingAddress.country)) {
    return NextResponse.json(
      { error: 'Zvolená doprava nedoručuje do vybrané země. Vyberte prosím jinou dopravu.' },
      { status: 400 }
    )
  }
  if (!paymentMethod || !paymentMethod.isActive) {
    return NextResponse.json(
      { error: 'Zvolený způsob platby není dostupný.' },
      { status: 400 }
    )
  }

  // Sestavíme řádky pro výpočet
  const orderLines: OrderLineInput[] = []
  const weightItems: CartWeightItem[] = []
  const itemSnapshots: Array<{
    productId: string
    variantId?: string
    productName: string
    productSku: string
    variantName?: string
    imageUrl?: string
    quantity: number
    unitPriceWithoutVat: number
    unitPriceWithVat: number
    vatRate: number
    unit: 'KS' | 'KG' | 'G_100' | 'L' | 'ML_100'
    expectedWeightKg?: number
  }> = []

  for (const item of data.items) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) {
      return NextResponse.json(
        { error: `Produkt ${item.productId} nebyl nalezen.` },
        { status: 400 }
      )
    }

    let unitPriceWithoutVat = Number(product.priceWithoutVat)
    let unitPriceWithVat = Number(product.priceWithVat)

    // Aktivní akční cena — sdílená logika platnosti (prošlá akce se
    // NEPOUŽIJE, nikdo nesmí objednat za cenu po konci akce)
    const salePrice = activeSalePrice({
      isOnSale: product.isOnSale,
      salePriceWithVat: product.salePriceWithVat ? Number(product.salePriceWithVat) : null,
      saleStartsAt: product.saleStartsAt,
      saleEndsAt: product.saleEndsAt,
    })
    if (salePrice !== null) {
      unitPriceWithVat = salePrice
      unitPriceWithoutVat = product.salePriceWithoutVat
        ? Number(product.salePriceWithoutVat)
        : computePriceWithoutVat(salePrice, Number(product.vatRate))
    }

    let variantName: string | undefined
    // Priorita hmotnosti jednotky: varianta → přibližná váha → logistická váha produktu
    let expectedWeightKg: number | undefined = product.approximateWeightKg
      ? Number(product.approximateWeightKg)
      : product.weightGrams
        ? product.weightGrams / 1000
        : undefined

    if (item.variantId) {
      const variant = variants.find((v) => v.id === item.variantId)
      if (!variant || variant.productId !== product.id) {
        return NextResponse.json(
          { error: `Varianta ${item.variantId} nebyla nalezena.` },
          { status: 400 }
        )
      }
      // Cena i váha VŽDY z DB varianty — hodnoty z klienta se nepoužívají
      unitPriceWithoutVat = Number(variant.priceWithoutVat)
      unitPriceWithVat = Number(variant.priceWithVat)
      variantName = variant.name
      expectedWeightKg = variant.weightKg ? Number(variant.weightKg) : expectedWeightKg
    }

    // „Cena na dotaz" (cena 0) nejde objednat online
    if (unitPriceWithVat <= 0) {
      return NextResponse.json(
        { error: `Produkt „${product.name}" má cenu na dotaz — objednejte ho prosím telefonicky nebo na prodejně.` },
        { status: 400 }
      )
    }

    orderLines.push({
      quantity: item.quantity,
      unitPriceWithVat,
      vatRate: Number(product.vatRate),
    })

    weightItems.push({
      quantity: item.quantity,
      isWeightBased: product.isWeightBased,
      isVariant: !!item.variantId,
      unit: product.unit,
      weightGrams: expectedWeightKg != null ? expectedWeightKg * 1000 : null,
    })

    itemSnapshots.push({
      productId: product.id,
      variantId: item.variantId,
      productName: product.name,
      productSku: product.sku,
      variantName,
      imageUrl: product.images[0]?.url,
      quantity: item.quantity,
      unitPriceWithoutVat,
      unitPriceWithVat,
      vatRate: Number(product.vatRate),
      unit: product.unit,
      expectedWeightKg,
    })
  }

  // Hmotnost košíku — výchozí váha položky z nastavení metody
  const cartWeightKg = calculateCartWeightKg(
    weightItems,
    shippingMethod.defaultItemWeightGrams,
  )
  if (shippingMethod.maxWeightKg && cartWeightKg > Number(shippingMethod.maxWeightKg)) {
    return NextResponse.json(
      {
        error: `Objednávka váží cca ${cartWeightKg.toLocaleString('cs-CZ')} kg — zvolená doprava zvládne max. ${Number(shippingMethod.maxWeightKg).toLocaleString('cs-CZ')} kg. Vyberte prosím jinou dopravu.`,
      },
      { status: 400 }
    )
  }

  // Cena dopravy: pásmo dle váhy → palivový příplatek → doprava zdarma
  // (sdílená funkce, stejná jako v pokladně — server je zdroj pravdy)
  const subtotalForFreeShipping = orderLines.reduce(
    (sum, l) => sum + l.unitPriceWithVat * l.quantity,
    0
  )
  const shippingPrice = resolveShippingPrice(
    {
      usesWeightTiers: shippingMethod.usesWeightTiers,
      priceWithVat: Number(shippingMethod.priceWithVat),
      weightTiers: shippingMethod.weightTiers.map((t) => ({
        maxWeightKg: Number(t.maxWeightKg),
        priceWithVat: Number(t.priceWithVat),
      })),
      fuelSurchargePercent: Number(shippingMethod.fuelSurchargePercent),
      freeShippingThreshold: shippingMethod.freeShippingThreshold
        ? Number(shippingMethod.freeShippingThreshold)
        : null,
    },
    cartWeightKg,
    subtotalForFreeShipping,
  )
  if (shippingPrice.priceWithVat === null) {
    return NextResponse.json(
      { error: 'Objednávka je nad váhový limit zvolené dopravy. Vyberte prosím jinou dopravu.' },
      { status: 400 }
    )
  }

  // Souhrn
  const totals = calculateOrderTotals({
    lines: orderLines,
    shippingPriceWithVat: shippingPrice.priceWithVat,
    shippingVatRate: Number(shippingMethod.vatRate),
    paymentFeeWithVat: Number(paymentMethod.feeWithVat),
    paymentFeeVatRate: Number(paymentMethod.vatRate),
    discountAmount: 0, // TODO: spočítat ze slevového kódu
  })

  const orderNumber = await generateNextNumber('ORDER')

  // Bezpečný token pro stránku „děkujeme" — nezaměnitelný s ID, neuhodnutelný
  const publicToken = crypto.randomBytes(24).toString('base64url')

  // Vytvoříme objednávku v transakci
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        publicToken,
        customerId,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        contactFirstName: data.contactFirstName,
        contactLastName: data.contactLastName,
        isBusinessOrder: data.isBusinessOrder,
        companyName: data.companyName,
        companyId: data.companyId,
        vatId: data.vatId,
        status: 'PENDING',
        // online platba čeká na bránu, ruční platby jsou „nezaplaceno"
        paymentStatus: paymentMethod.provider === 'PAYPAL' ? 'PENDING' : 'UNPAID',
        fulfillmentStatus: 'UNFULFILLED',
        shippingAddressSnapshot: data.shippingAddress,
        billingAddressSnapshot: data.billingAddressSameAsShipping
          ? data.shippingAddress
          : data.billingAddress,
        shippingMethodId: shippingMethod.id,
        shippingMethodName: shippingMethod.name,
        shippingPriceWithoutVat: totals.shippingWithoutVat,
        shippingPriceWithVat: totals.shippingWithVat,
        preferredDeliveryDate: data.preferredDeliveryDate
          ? new Date(data.preferredDeliveryDate)
          : undefined,
        deliveryTimeSlot: data.deliveryTimeSlot,
        deliveryNote: data.deliveryNote,
        paymentMethodId: paymentMethod.id,
        paymentMethodName: paymentMethod.name,
        paymentFeeWithoutVat: totals.paymentFeeWithoutVat,
        paymentFeeWithVat: totals.paymentFeeWithVat,
        discountCodeId: discount?.id,
        discountAmount: totals.discountAmount,
        subtotalWithoutVat: totals.subtotalWithoutVat,
        subtotalWithVat: totals.subtotalWithVat,
        totalVat: totals.totalVat,
        totalWithoutVat: totals.totalWithoutVat,
        totalWithVat: totals.totalWithVat,
        customerNote: data.customerNote,
        items: {
          create: itemSnapshots.map((s) => {
            const lineWithVat = s.unitPriceWithVat * s.quantity
            const lineWithoutVat = s.unitPriceWithoutVat * s.quantity
            return {
              productId: s.productId,
              variantId: s.variantId,
              productName: s.productName,
              productSku: s.productSku,
              variantName: s.variantName,
              imageUrl: s.imageUrl,
              quantity: s.quantity,
              expectedWeightKg: s.expectedWeightKg,
              unitPriceWithoutVat: s.unitPriceWithoutVat,
              unitPriceWithVat: s.unitPriceWithVat,
              vatRate: s.vatRate,
              unit: s.unit,
              lineTotalWithoutVat: Math.round(lineWithoutVat * 100) / 100,
              lineTotalWithVat: Math.round(lineWithVat * 100) / 100,
              lineVatAmount: Math.round((lineWithVat - lineWithoutVat) * 100) / 100,
            }
          }),
        },
      },
      include: { items: true },
    })

    // Inkrement použití slevového kódu
    if (discount) {
      await tx.discountCode.update({
        where: { id: discount.id },
        data: { usedCount: { increment: 1 } },
      })
    }

    return created
  })

  // ─── PayPal: vytvořit platbu na bráně a vrátit approval URL ──────
  // Potvrzovací e-mail se u PayPalu posílá až PO zaplacení (v return
  // handleru) — zákazník, který nezaplatí, nedostane potvrzení.
  if (paymentMethod.provider === 'PAYPAL') {
    if (!paypalConfigured()) {
      return NextResponse.json(
        { error: 'Platba přes PayPal momentálně není dostupná. Zvolte prosím jinou platbu.' },
        { status: 400 }
      )
    }
    try {
      const origin = req.nextUrl.origin
      const paypal = await createPayPalOrder({
        amount: totals.totalWithVat,
        referenceId: orderNumber,
        returnUrl: `${origin}/api/paypal/return`,
        cancelUrl: `${origin}/api/paypal/cancel`,
      })
      await prisma.order.update({
        where: { id: order.id },
        data: { paypalOrderId: paypal.paypalOrderId },
      })
      await prisma.orderNote.create({
        data: {
          orderId: order.id,
          content: `Vytvořena PayPal platba ${paypal.paypalOrderId}, zákazník přesměrován k zaplacení.`,
        },
      }).catch(() => {})

      return NextResponse.json(
        { ...order, approvalUrl: paypal.approvalUrl },
        { status: 201 }
      )
    } catch (err) {
      // Objednávka zůstává PENDING — zákazník může zkusit jinou platbu,
      // obsluha ji vidí v adminu
      console.error('[orders] PayPal order selhal:', err)
      await prisma.orderNote.create({
        data: {
          orderId: order.id,
          content: `PayPal platbu se nepodařilo založit: ${err instanceof Error ? err.message : String(err)}`,
        },
      }).catch(() => {})
      return NextResponse.json(
        { error: 'Platbu přes PayPal se nepodařilo založit. Zkuste to prosím znovu, nebo zvolte jinou platbu — objednávka zůstává uložená.' },
        { status: 502 }
      )
    }
  }

  // Potvrzovací e-mail — selhání nesmí shodit vytvoření objednávky
  // (výsledek se zapisuje do EmailLog + poznámky objednávky uvnitř)
  await sendOrderConfirmationEmail(order.id).catch((err) => {
    console.error('[orders] potvrzovací email selhal:', err)
  })

  return NextResponse.json(order, { status: 201 })
}

export async function GET(req: NextRequest) {
  // Seznam objednávek smí číst jen přihlášený správce
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášen.' }, { status: 401 })
  }
  const params = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(params.get('page') ?? '1'))
  const pageSize = Math.min(100, parseInt(params.get('pageSize') ?? '20'))
  const status = params.get('status')

  const where = status ? { status: status as any } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: { select: { id: true, productName: true, quantity: true } },
        customer: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return NextResponse.json({
    items: orders,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}
