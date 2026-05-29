import { requireRole } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { StatisticsSubSidebar } from './_components/StatisticsSubSidebar'

export default async function StatistikyLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole(['OWNER', 'ADMIN'])

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/statistiky" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Statistiky" user={user} />
        <div className="flex flex-1 overflow-hidden">
          <StatisticsSubSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
