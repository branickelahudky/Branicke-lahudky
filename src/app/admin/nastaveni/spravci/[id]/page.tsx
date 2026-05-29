import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth-roles'
import { loadAdminUserDetail } from '../actions'
import { SpravceDetailClient } from './SpravceDetailClient'

interface Props { params: Promise<{ id: string }> }

export default async function SpravceDetailPage({ params }: Props) {
  const { id } = await params
  const { user: currentUser } = await requireRole(['OWNER', 'ADMIN'])
  const { adminUser, auditLogs } = await loadAdminUserDetail(id)

  if (!adminUser) notFound()

  return (
    <SpravceDetailClient
      currentUserId={currentUser.id}
      currentUserRole={currentUser.role}
      adminUser={adminUser}
      auditLogs={auditLogs}
    />
  )
}
