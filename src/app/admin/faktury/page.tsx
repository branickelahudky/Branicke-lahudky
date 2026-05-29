import { Prisma, DocumentType, DocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { FakturyClient, type SerializedInvoice } from './FakturyClient'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{
    hledat?: string
    strana?: string
    status?: string
    od?: string
    do?: string
  }>
}

export default async function FakturyPage({ searchParams }: Props) {
  const { user } = await requireAuth()
  const params = await searchParams

  const currentPage = Math.max(1, parseInt(params.strana ?? '1') || 1)
  const currentSearch = params.hledat ?? ''
  const currentStatus = params.status ?? ''
  const dateFrom = params.od ?? ''
  const dateTo = params.do ?? ''

  const where: Prisma.DocumentWhereInput = { type: DocumentType.INVOICE }

  if (currentStatus === 'VALID') where.status = DocumentStatus.VALID
  else if (currentStatus === 'CANCELLED') where.status = DocumentStatus.CANCELLED

  if (currentSearch) {
    where.OR = [
      { number: { contains: currentSearch, mode: 'insensitive' } },
      { customerName: { contains: currentSearch, mode: 'insensitive' } },
    ]
  }
  if (dateFrom) {
    where.issueDate = { ...((where.issueDate as object) ?? {}), gte: new Date(dateFrom) }
  }
  if (dateTo) {
    const end = new Date(dateTo)
    end.setDate(end.getDate() + 1)
    where.issueDate = { ...((where.issueDate as object) ?? {}), lt: end }
  }

  const [total, docs] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy: { issueDate: 'desc' },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        order: { select: { paymentStatus: true } },
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invoices: SerializedInvoice[] = docs.map((doc) => ({
    id: doc.id,
    number: doc.number,
    status: doc.status,
    customerName: doc.customerName,
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate.toISOString(),
    totalWithVat: Number(doc.totalWithVat),
    paymentMethod: doc.paymentMethod,
    orderId: doc.orderId,
    orderPaymentStatus: doc.order?.paymentStatus ?? null,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/faktury" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Faktury" user={user} />
        <FakturyClient
          invoices={invoices}
          total={total}
          totalPages={totalPages}
          currentPage={currentPage}
          currentSearch={currentSearch}
          currentStatus={currentStatus}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>
    </div>
  )
}
