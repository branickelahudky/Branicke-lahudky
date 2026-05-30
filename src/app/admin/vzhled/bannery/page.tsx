import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  BanneryClient,
  type SerializedBanner,
  type PageOption,
  type CategoryOption,
} from './BanneryClient'

export default async function BanneryPage() {
  const { user } = await requireAuth()

  const [banners, pages, cats] = await Promise.all([
    prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        page: { select: { title: true } },
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
    }),
    prisma.page.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, slug: true } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
  ])

  const serializedBanners: SerializedBanner[] = banners.map((b) => ({
    id: b.id,
    imageUrl: b.imageUrl,
    imageStorageKey: b.imageStorageKey,
    imageAlt: b.imageAlt,
    linkType: b.linkType,
    pageId: b.pageId,
    pageName: b.page?.title ?? null,
    categoryId: b.categoryId,
    categoryName: b.category
      ? b.category.parent ? `${b.category.parent.name} › ${b.category.name}` : b.category.name
      : null,
    url: b.url,
    openNewTab: b.openNewTab,
    sortOrder: b.sortOrder,
    isVisible: b.isVisible,
  }))

  const serializedPages: PageOption[] = pages.map((p) => ({
    id: p.id, title: p.title, slug: p.slug,
  }))

  const serializedCategories: CategoryOption[] = cats.map((c) => ({
    id: c.id,
    displayName: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/bannery" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Bannery" user={user} />
        <div className="p-6 max-w-3xl">
          <p className="mb-4 text-sm text-stone-500">
            Carousel obrázků pro homepage. Doporučený poměr stran 16:6, šířka min. 1600 px.
          </p>
          <BanneryClient
            banners={serializedBanners}
            pages={serializedPages}
            categories={serializedCategories}
          />
        </div>
      </div>
    </div>
  )
}
