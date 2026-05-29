import { requireAuth } from '@/lib/auth-roles'
import { prisma } from '@/lib/prisma'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import { ProfilClient } from './ProfilClient'

export default async function ProfilPage() {
  const { user } = await requireAuth()

  const auditLogs = await prisma.adminAuditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/profil" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title="Můj profil" user={user} />
        <main className="flex-1 overflow-auto">
          <ProfilClient
            user={{
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              lastLoginAt: user.lastLoginAt ?? null,
              lastLoginIp: user.lastLoginIp ?? null,
              createdAt: user.createdAt,
            }}
            auditLogs={auditLogs}
          />
        </main>
      </div>
    </div>
  )
}
