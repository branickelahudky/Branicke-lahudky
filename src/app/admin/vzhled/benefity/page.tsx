import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { BenefityClient, type SerializedUspItem } from './BenefityClient'

export default async function BenefityPage() {
  const { user } = await requireAuth()

  const items = await prisma.uspItem.findMany({ orderBy: { sortOrder: 'asc' } })

  const serialized: SerializedUspItem[] = items.map((i) => ({
    id: i.id,
    icon: i.icon,
    title: i.title,
    subtitle: i.subtitle,
    isActive: i.isActive,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/benefity" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Benefity (USP)" user={user} />
        <div className="p-6 max-w-2xl">
          <p className="mb-4 text-sm text-stone-500">
            Benefity obchodu — doprava, chlazení, tradice… Zobrazují se v tenkém proužku
            úplně nahoře na celém webu (a zkráceně v pokladně nad souhrnem). Pořadí měňte
            přetažením; neaktivní položky se na webu nezobrazují.
          </p>
          <BenefityClient items={serialized} readOnly={user.role === 'STAFF'} />
        </div>
      </div>
    </div>
  )
}
