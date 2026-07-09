import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { SeoClient, type SerializedSeoSettings } from './SeoClient'

async function getOrCreateSeoSettings() {
  const existing = await prisma.seoSettings.findFirst()
  if (existing) return existing
  return prisma.seoSettings.create({ data: {} })
}

export default async function SeoPage() {
  const { user } = await requireAuth()

  const settings = await getOrCreateSeoSettings()

  const serialized: SerializedSeoSettings = {
    siteTitle: settings.siteTitle,
    titleTemplate: settings.titleTemplate,
    metaDescription: settings.metaDescription,
    ogImageUrl: settings.ogImageUrl,
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/vzhled/seo" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="SEO" user={user} />
        <div className="p-6 max-w-2xl">
          <p className="mb-5 text-sm text-stone-500">
            Globální nastavení pro vyhledávače a sociální sítě. Titulky a popisy
            konkrétních produktů či kategorií nastavíte přímo u nich.
          </p>
          <SeoClient settings={serialized} />
        </div>
      </div>
    </div>
  )
}
