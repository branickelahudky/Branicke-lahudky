import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { SettingsSubSidebar } from './_components/SettingsSubSidebar'

export default async function NastaveniLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireAuth()

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/nastaveni" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Nastavení" user={user} />
        <div className="flex flex-1 overflow-hidden">
          <SettingsSubSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
