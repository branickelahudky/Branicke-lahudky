import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { CategoriesSeoClient, type SerializedCategorySeo } from './CategoriesSeoClient'

export default async function CategoriesSeoPage() {
  const { user } = await requireAuth()

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, slug: true, parentId: true,
      description: true, metaTitle: true, metaDescription: true,
      _count: { select: { products: true } },
    },
  })

  // Kořeny první, děti hned za rodičem
  const roots = categories.filter((c) => !c.parentId)
  const ordered: SerializedCategorySeo[] = []
  for (const root of roots) {
    ordered.push(serialize(root, 0))
    for (const child of categories.filter((c) => c.parentId === root.id)) {
      ordered.push(serialize(child, 1))
    }
  }

  function serialize(c: (typeof categories)[number], depth: number): SerializedCategorySeo {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      depth,
      description: c.description,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      productCount: c._count.products,
    }
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/produkty" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="SEO kategorií" user={user} />
        <div className="p-6 max-w-3xl">
          <p className="mb-5 text-sm text-stone-500">
            Meta title a description pro stránky kategorií. Nevyplněné kategorie
            používají automatický titulek a popis.
          </p>
          <CategoriesSeoClient categories={ordered} />
        </div>
      </div>
    </div>
  )
}
