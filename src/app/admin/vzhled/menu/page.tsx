import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  MenuClient,
  type SerializedMenuItem,
  type SerializedPageOption,
  type SerializedCategoryOption,
} from './MenuClient'

export default async function MenuPage() {
  const { user } = await requireAuth()

  const [menuItems, allPages, cats] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        page: { select: { title: true } },
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
    }),
    prisma.page.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, slug: true },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
  ])

  const serialize = (item: typeof menuItems[0]): SerializedMenuItem => ({
    id: item.id,
    location: item.location,
    label: item.label,
    linkType: item.linkType,
    pageId: item.pageId,
    pageName: item.page?.title ?? null,
    categoryId: item.categoryId,
    categoryName: item.category
      ? item.category.parent
        ? `${item.category.parent.name} › ${item.category.name}`
        : item.category.name
      : null,
    url: item.url,
    openNewTab: item.openNewTab,
    sortOrder: item.sortOrder,
    isVisible: item.isVisible,
  })

  const headerItems = menuItems.filter((i) => i.location === 'HEADER').map(serialize)
  const footerItems = menuItems.filter((i) => i.location === 'FOOTER').map(serialize)

  const serializedPages: SerializedPageOption[] = allPages.map((p) => ({
    id: p.id, title: p.title, slug: p.slug,
  }))

  const serializedCategories: SerializedCategoryOption[] = cats.map((c) => ({
    id: c.id,
    displayName: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/menu" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Navigační menu" user={user} />
        <div className="p-6">
          <p className="mb-4 text-sm text-stone-500">
            Spravujte položky hlavního menu a patičky webu. Pořadí měňte přetažením.
          </p>
          <MenuClient
            headerItems={headerItems}
            footerItems={footerItems}
            pages={serializedPages}
            categories={serializedCategories}
          />
        </div>
      </div>
    </div>
  )
}
