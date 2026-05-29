import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { PageEditor } from './PageEditor'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StrankaDetailPage({ params }: Props) {
  const { user } = await requireAuth()
  const { id } = await params

  const page = await prisma.page.findUnique({
    where: { id },
    select: {
      id: true, title: true, slug: true, excerpt: true, content: true,
      isPublished: true, isSystem: true, metaTitle: true,
      metaDescription: true, robotsIndex: true,
    },
  })

  if (!page) notFound()

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/stranky" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title={page.title} user={user} />
        <PageEditor page={page} />
      </div>
    </div>
  )
}
