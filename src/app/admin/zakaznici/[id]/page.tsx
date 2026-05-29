import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  CustomerDetailClient,
  type SerializedCustomerDetail,
  type SerializedAddress,
} from './CustomerDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: Props) {
  const { user } = await requireAuth()
  const { id } = await params

  const [customer, orderGroups, lastOrder] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }],
        },
      },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { customerId: id },
      _count: { _all: true },
      _sum: { totalWithVat: true },
    }),
    prisma.order.findFirst({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])

  if (!customer) notFound()

  // ── Výpočet statistik objednávek ────────────────────────────────

  const cancelledStatuses = new Set(['CANCELLED', 'REFUNDED'])
  let completedCount = 0
  let completedTotal = 0
  let cancelledCount = 0
  let cancelledTotal = 0
  let totalOrderCount = 0
  const allStatuses: string[] = []

  for (const group of orderGroups) {
    const count = group._count._all
    const sum = Number(group._sum.totalWithVat ?? 0)
    totalOrderCount += count
    for (let i = 0; i < count; i++) allStatuses.push(group.status)

    if (cancelledStatuses.has(group.status)) {
      cancelledCount += count
      cancelledTotal += sum
    } else {
      completedCount += count
      completedTotal += sum
    }
  }

  // ── Adresy ─────────────────────────────────────────────────────

  const billingAddress =
    customer.addresses.find((a) => a.type === 'BILLING' || a.type === 'BOTH') ?? null
  const shippingAddress =
    customer.addresses.find((a) => a.type === 'SHIPPING') ?? null

  function serializeAddress(a: typeof billingAddress): SerializedAddress | null {
    if (!a) return null
    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      street: a.street,
      city: a.city,
      postalCode: a.postalCode,
      country: a.country,
    }
  }

  // ── Serialize ───────────────────────────────────────────────────

  const serialized: SerializedCustomerDetail = {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    shoptetId: customer.shoptetId,
    hasPassword: customer.passwordHash !== null,
    isBusinessCustomer: customer.isBusinessCustomer,
    companyName: customer.companyName,
    companyId: customer.companyId,
    vatId: customer.vatId,
    internalNote: customer.internalNote,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    addressCount: customer.addresses.length,
    billingAddress: serializeAddress(billingAddress),
    shippingAddress: serializeAddress(shippingAddress),
    orderStats: {
      totalCount: totalOrderCount,
      completedCount,
      completedTotal,
      cancelledCount,
      cancelledTotal,
      lastOrderAt: lastOrder?.createdAt.toISOString() ?? null,
    },
    orderStatuses: allStatuses,
  }

  const fullName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/zakaznici" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title={fullName} user={user} />
        <CustomerDetailClient customer={serialized} userRole={user.role} />
      </div>
    </div>
  )
}
