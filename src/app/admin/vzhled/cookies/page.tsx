import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  CookiesClient,
  type SerializedCookieSettings,
  type SerializedPageOption,
} from './CookiesClient'

async function getOrCreate() {
  const existing = await prisma.cookieSettings.findFirst()
  if (existing) return existing
  return prisma.cookieSettings.create({ data: {} })
}

export default async function CookiesPage() {
  const { user } = await requireAuth()

  const [settings, pages] = await Promise.all([
    getOrCreate(),
    prisma.page.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, slug: true } }),
  ])

  const serialized: SerializedCookieSettings = {
    enabled: settings.enabled,
    bannerTitle: settings.bannerTitle,
    bannerText: settings.bannerText,
    acceptAllLabel: settings.acceptAllLabel,
    rejectLabel: settings.rejectLabel,
    policyPageId: settings.policyPageId,
  }

  const serializedPages: SerializedPageOption[] = pages.map((p) => ({
    id: p.id, title: p.title, slug: p.slug,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/cookies" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Cookies" user={user} />
        <div className="p-6 max-w-2xl">
          <p className="mb-5 text-sm text-stone-500">
            Nastavení cookies lišty — texty, tlačítka a odkaz na zásady.
          </p>
          <CookiesClient settings={serialized} pages={serializedPages} />
        </div>
      </div>
    </div>
  )
}
