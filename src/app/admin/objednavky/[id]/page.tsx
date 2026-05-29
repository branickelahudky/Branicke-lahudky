import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { DocumentType } from '@prisma/client'
import { computeCustomerRating } from '@/lib/customer-rating'
import { computeAllowedStatuses } from '@/lib/order-status'
import { peekDocumentNumber } from '@/lib/document-numbering'
import {
  OrderDetailClient,
  SerializedOrder,
  SerializedItem,
  SerializedNote,
} from './OrderDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { user } = await requireAuth()
  const { id } = await params

  const [order, paymentMethods, existingInvoiceDoc, supplierSettings] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }, take: 1, select: { url: true } },
              },
            },
            variant: { select: { name: true } },
          },
          orderBy: { id: 'asc' },
        },
        customer: {
          select: { orders: { select: { status: true } } },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: {
            adminUser: { select: { firstName: true, lastName: true } },
          },
        },
        discountCode: { select: { code: true } },
      },
    }),
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.document.findFirst({
      where: { orderId: id, type: DocumentType.INVOICE },
      select: { id: true, number: true },
    }),
    prisma.supplierSettings.findFirst({
      select: { defaultDueDays: true },
    }),
  ])

  if (!order) notFound()

  // Prev / next orders by createdAt (for navigation arrows)
  const [prevOrder, nextOrder] = await Promise.all([
    prisma.order.findFirst({
      where: { createdAt: { lt: order.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.order.findFirst({
      where: { createdAt: { gt: order.createdAt } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  ])

  const existingInvoice = existingInvoiceDoc
    ? { id: existingInvoiceDoc.id, number: existingInvoiceDoc.number }
    : null
  const defaultDueDays = supplierSettings?.defaultDueDays ?? 14
  const proposedInvoiceNumber = existingInvoice
    ? ''
    : await peekDocumentNumber(DocumentType.INVOICE)

  const customerRating = order.customer
    ? computeCustomerRating(order.customer.orders.map((o) => o.status))
    : null

  const allowedStatuses = computeAllowedStatuses(order.status, user.role)

  // ── Serialize (convert Decimal → number, Date → ISO string) ──

  const serializedItems: SerializedItem[] = order.items.map((item) => ({
    id: item.id,
    productName: item.productName,
    productSku: item.productSku,
    variantName: item.variantName ?? null,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceWithVat: Number(item.unitPriceWithVat),
    unitPriceWithoutVat: Number(item.unitPriceWithoutVat),
    lineTotalWithVat: Number(item.lineTotalWithVat),
    lineTotalWithoutVat: Number(item.lineTotalWithoutVat),
    lineVatAmount: Number(item.lineVatAmount),
    vatRate: Number(item.vatRate),
    actualWeightKg: item.actualWeightKg != null ? Number(item.actualWeightKg) : null,
    expectedWeightKg: item.expectedWeightKg != null ? Number(item.expectedWeightKg) : null,
    imageUrl: item.product?.images?.[0]?.url ?? null,
    fulfilledQuantity: item.fulfilledQuantity,
    isWeightBased: item.product?.isWeightBased ?? false,
    discount: item.discount != null ? Number(item.discount) : 0,
    itemNote: item.itemNote ?? null,
  }))

  const serializedNotes: SerializedNote[] = order.notes.map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
    adminUserName: n.adminUser
      ? `${n.adminUser.firstName} ${n.adminUser.lastName}`
      : null,
  }))

  const serializedOrder: SerializedOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethodId: order.paymentMethodId ?? null,
    paymentMethodName: order.paymentMethodName,
    shippingMethodName: order.shippingMethodName,
    trackingNumber: order.trackingNumber ?? null,
    preferredDeliveryDate: order.preferredDeliveryDate
      ? order.preferredDeliveryDate.toISOString().slice(0, 10)
      : null,
    deliveryTimeSlot: order.deliveryTimeSlot ?? null,
    deliveryNote: order.deliveryNote ?? null,
    contactFirstName: order.contactFirstName,
    contactLastName: order.contactLastName,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    isBusinessOrder: order.isBusinessOrder,
    companyName: order.companyName ?? null,
    companyId: order.companyId ?? null,
    vatId: order.vatId ?? null,
    shippingAddressSnapshot: order.shippingAddressSnapshot as SerializedOrder['shippingAddressSnapshot'],
    billingAddressSnapshot: order.billingAddressSnapshot
      ? (order.billingAddressSnapshot as SerializedOrder['billingAddressSnapshot'])
      : null,
    subtotalWithVat: Number(order.subtotalWithVat),
    shippingPriceWithVat: Number(order.shippingPriceWithVat),
    paymentFeeWithVat: Number(order.paymentFeeWithVat),
    discountAmount: Number(order.discountAmount),
    totalVat: Number(order.totalVat),
    totalWithVat: Number(order.totalWithVat),
    discountCode: order.discountCode?.code ?? null,
    customerNote: order.customerNote ?? null,
    internalNote: order.internalNote ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    preparedAt: order.preparedAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    customerId: order.customerId ?? null,
    customerRating,
    items: serializedItems,
    notes: serializedNotes,
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/objednavky" />
      <div className="flex flex-1 flex-col">
        <AdminHeader title={`Objednávka ${order.orderNumber}`} user={user} />
        <OrderDetailClient
          order={serializedOrder}
          paymentMethods={paymentMethods}
          prevOrderId={prevOrder?.id ?? null}
          nextOrderId={nextOrder?.id ?? null}
          allowedStatuses={allowedStatuses}
          existingInvoice={existingInvoice}
          proposedInvoiceNumber={proposedInvoiceNumber}
          defaultDueDays={defaultDueDays}
        />
      </div>
    </div>
  )
}
