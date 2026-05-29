import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  FakturaDetailClient,
  type SerializedDocument,
  type SerializedDocumentItem,
  type VatBreakdownEntry,
} from './FakturaDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FakturaDetailPage({ params }: Props) {
  const { user } = await requireAuth()
  const { id } = await params

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      order: { select: { orderNumber: true } },
    },
  })

  if (!doc) notFound()

  const serializedItems: SerializedDocumentItem[] = doc.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unit: item.unit,
    unitPriceWithoutVat: Number(item.unitPriceWithoutVat),
    unitPriceWithVat: Number(item.unitPriceWithVat),
    vatRate: item.vatRate,
    discount: item.discount != null ? Number(item.discount) : null,
    lineTotalWithoutVat: Number(item.lineTotalWithoutVat),
    lineVatAmount: Number(item.lineVatAmount),
    lineTotalWithVat: Number(item.lineTotalWithVat),
    sortOrder: item.sortOrder,
  }))

  const vatBreakdown = (doc.vatBreakdown as VatBreakdownEntry[]) ?? []

  const serialized: SerializedDocument = {
    id: doc.id,
    number: doc.number,
    status: doc.status,
    orderId: doc.orderId,
    orderNumber: doc.order?.orderNumber ?? null,
    customerId: doc.customerId,
    supplierName: doc.supplierName,
    supplierStreet: doc.supplierStreet,
    supplierCity: doc.supplierCity,
    supplierPostalCode: doc.supplierPostalCode,
    supplierCountry: doc.supplierCountry,
    supplierCompanyId: doc.supplierCompanyId,
    supplierVatId: doc.supplierVatId,
    supplierBankAccount: doc.supplierBankAccount,
    supplierLegalNote: doc.supplierLegalNote,
    customerName: doc.customerName,
    customerStreet: doc.customerStreet,
    customerCity: doc.customerCity,
    customerPostalCode: doc.customerPostalCode,
    customerCountry: doc.customerCountry,
    customerCompanyId: doc.customerCompanyId,
    customerVatId: doc.customerVatId,
    customerEmail: doc.customerEmail,
    customerPhone: doc.customerPhone,
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate.toISOString(),
    taxDate: doc.taxDate.toISOString(),
    variableSymbol: doc.variableSymbol,
    constantSymbol: doc.constantSymbol,
    specificSymbol: doc.specificSymbol,
    paymentMethod: doc.paymentMethod,
    pricesIncludeVat: doc.pricesIncludeVat,
    subtotalWithoutVat: Number(doc.subtotalWithoutVat),
    totalVat: Number(doc.totalVat),
    totalWithVat: Number(doc.totalWithVat),
    vatBreakdown,
    items: serializedItems,
    note: doc.note,
    internalNote: doc.internalNote,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/faktury" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title={`Faktura ${doc.number}`} user={user} />
        <FakturaDetailClient doc={serialized} userRole={user.role} />
      </div>
    </div>
  )
}
