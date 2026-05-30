import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  HomepageClient,
  type SerializedSection,
  type CategoryOption,
} from './HomepageClient'

export default async function TitulniStranaPage() {
  const { user } = await requireAuth()

  const [sections, cats, activeBannerCount] = await Promise.all([
    prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
    prisma.banner.count({ where: { isVisible: true } }),
  ])

  const serializedSections: SerializedSection[] = sections.map((s) => ({
    id: s.id,
    type: s.type,
    isVisible: s.isVisible,
    sortOrder: s.sortOrder,
    title: s.title,
    config: s.config,
  }))

  const serializedCategories: CategoryOption[] = cats.map((c) => ({
    id: c.id,
    displayName: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/titulni-strana" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Titulní strana" user={user} />
        <div className="p-6 max-w-2xl">
          <p className="mb-4 text-sm text-stone-500">
            Konfigurace sekcí homepage — pořadí, viditelnost a obsah každé sekce.
          </p>
          <HomepageClient
            sections={serializedSections}
            categories={serializedCategories}
            activeBannerCount={activeBannerCount}
          />
        </div>
      </div>
    </div>
  )
}
