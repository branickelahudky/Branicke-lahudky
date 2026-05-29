// POST /api/orders - vytvoření objednávky
// GET /api/orders - seznam objednávek (admin)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  calculateOrderTotals,
  type OrderLineInput,
} from '@/lib/pricing'
import { generateNextNumber } from '@/lib/number-series'

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

  // Volitelně - přihlášený zákazník
  customerId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const data = createOrderSchema.parse(body)

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
    prisma.shippingMethod.findUnique({ where: { id: data.shippingMethodId } }),
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
  if (!paymentMethod || !paymentMethod.isActive) {
    return NextResponse.json(
      { error: 'Zvolený způsob platby není dostupný.' },
      { status: 400 }
    )
  }

  // Sestavíme řádky pro výpočet
  const orderLines: OrderLineInput[] = []
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
    let variantName: string | undefined
    let expectedWeightKg: number | undefined = product.approximateWeightKg
      ? Number(product.approximateWeightKg)
      : undefined

    if (item.variantId) {
      const variant = variants.find((v) => v.id === item.variantId)
      if (!variant) {
        return NextResponse.json(
          { error: `Varianta ${item.variantId} nebyla nalezena.` },
          { status: 400 }
        )
      }
      unitPriceWithoutVat = Number(variant.priceWithoutVat)
      unitPriceWithVat = Number(variant.priceWithVat)
      variantName = variant.name
      expectedWeightKg = variant.weightKg ? Number(variant.weightKg) : expectedWeightKg
    }

    orderLines.push({
      quantity: item.quantity,
      unitPriceWithVat,
      vatRate: Number(product.vatRate),
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

  // Doprava zdarma od limitu
  const subtotalForFreeShipping = orderLines.reduce(
    (sum, l) => sum + l.unitPriceWithVat * l.quantity,
    0
  )
  const isFreeShipping =
    shippingMethod.freeShippingThreshold &&
    subtotalForFreeShipping >= Number(shippingMethod.freeShippingThreshold)

  // Souhrn
  const totals = calculateOrderTotals({
    lines: orderLines,
    shippingPriceWithVat: isFreeShipping ? 0 : Number(shippingMethod.priceWithVat),
    shippingVatRate: Number(shippingMethod.vatRate),
    paymentFeeWithVat: Number(paymentMethod.feeWithVat),
    paymentFeeVatRate: Number(paymentMethod.vatRate),
    discountAmount: 0, // TODO: spočítat ze slevového kódu
  })

  const orderNumber = await generateNextNumber('ORDER')

  // Vytvoříme objednávku v transakci
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        contactFirstName: data.contactFirstName,
        contactLastName: data.contactLastName,
        isBusinessOrder: data.isBusinessOrder,
        companyName: data.companyName,
        companyId: data.companyId,
        vatId: data.vatId,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
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

  // TODO: poslat potvrzovací email
  // TODO: pokud platba kartou, vytvořit platbu na bráně a vrátit redirect URL

  return NextResponse.json(order, { status: 201 })
}

export async function GET(req: NextRequest) {
  // TODO: ověřit admin session
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
