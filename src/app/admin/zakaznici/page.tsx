import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { CustomersClient, type SerializedCustomer } from './CustomersClient'

const PAGE_SIZE = 30

interface Props {
  searchParams: Promise<{
    hledat?: string
    strana?: string
    sort?: string
    order?: string
    ucet?: string
  }>
}

export default async function ZakazniciPage({ searchParams }: Props) {
  const { user } = await requireAuth()
  const params = await searchParams

  const currentPage = Math.max(1, parseInt(params.strana ?? '1') || 1)
  const sort = params.sort ?? 'lastName'
  const dir: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc'
  const currentSearch = params.hledat ?? ''
  const accountFilter =
    params.ucet === 's-uctem' || params.ucet === 'bez-uctu' ? params.ucet : 'vsichni'

  // ── Where clause ─────────────────────────────────────────────────

  const where: Prisma.CustomerWhereInput = {}

  if (currentSearch) {
    where.OR = [
      { firstName: { contains: currentSearch, mode: 'insensitive' } },
      { lastName: { contains: currentSearch, mode: 'insensitive' } },
      { email: { contains: currentSearch, mode: 'insensitive' } },
      { addresses: { some: { city: { contains: currentSearch, mode: 'insensitive' } } } },
    ]
  }

  // „Má účet" = passwordHash není null
  if (accountFilter === 's-uctem') where.passwordHash = { not: null }
  if (accountFilter === 'bez-uctu') where.passwordHash = null

  // ── Fetch all matching customers with order stats ──────────────────

  const allCustomers = await prisma.customer.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: {
      orders: {
        select: {
          status: true,
          totalWithVat: true,
        },
      },
      addresses: {
        where: { isDefault: true },
        select: {
          city: true,
        },
      },
      // Poslední aktivita účtu = poslední vytvořená session
      sessions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  })

  // ── Compute derived fields ────────────────────────────────────────

  const withStats = allCustomers.map((c) => ({
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    shoptetId: c.shoptetId,
    isBusinessCustomer: c.isBusinessCustomer,
    companyName: c.companyName,
    companyId: c.companyId,
    internalNote: c.internalNote,
    createdAt: c.createdAt,
    orderCount: c.orders.length,
    totalSpent: c.orders.reduce((sum, o) => sum + Number(o.totalWithVat), 0),
    orderStatuses: c.orders.map((o) => o.status as string),
    addressCity: c.addresses[0]?.city ?? null,
    hasAccount: c.passwordHash !== null,
    emailVerified: c.emailVerified !== null,
    accountDisabled: c.isAccountDisabled,
    lastSessionAt: c.sessions[0]?.createdAt ?? null,
  }))

  // ── Sort ──────────────────────────────────────────────────────────

  withStats.sort((a, b) => {
    let cmp = 0
    switch (sort) {
      case 'email':
        cmp = a.email.localeCompare(b.email, 'cs')
        break
      case 'orderCount':
        cmp = a.orderCount - b.orderCount
        break
      case 'totalSpent':
        cmp = a.totalSpent - b.totalSpent
        break
      case 'createdAt':
        cmp = a.createdAt.getTime() - b.createdAt.getTime()
        break
      default: // 'lastName'
        cmp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'cs')
    }
    return dir === 'asc' ? cmp : -cmp
  })

  // ── Paginate ──────────────────────────────────────────────────────

  const total = withStats.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = withStats.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // ── Serialize (Date → ISO string, Decimal already converted) ──────

  const serialized: SerializedCustomer[] = page.map((c) => ({
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    shoptetId: c.shoptetId,
    isBusinessCustomer: c.isBusinessCustomer,
    companyName: c.companyName,
    companyId: c.companyId,
    internalNote: c.internalNote,
    createdAt: c.createdAt.toISOString(),
    orderStatuses: c.orderStatuses,
    orderCount: c.orderCount,
    totalSpent: c.totalSpent,
    addressCity: c.addressCity,
    hasAccount: c.hasAccount,
    emailVerified: c.emailVerified,
    accountDisabled: c.accountDisabled,
    lastSessionAt: c.lastSessionAt ? c.lastSessionAt.toISOString() : null,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/zakaznici" />
      <div className="flex flex-1 flex-col">
        <AdminHeader title="Zákazníci" user={user} />
        <CustomersClient
          customers={serialized}
          total={total}
          totalPages={totalPages}
          currentPage={currentPage}
          sort={sort}
          dir={dir}
          currentSearch={currentSearch}
          accountFilter={accountFilter}
        />
      </div>
    </div>
  )
}
