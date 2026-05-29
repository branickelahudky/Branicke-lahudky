import { requireRole } from '@/lib/auth-roles'
import { loadSpravciData } from './actions'
import { SpravciClient } from './SpravciClient'

export default async function SpravciPage() {
  const { user } = await requireRole(['OWNER', 'ADMIN'])
  const { activeUsers, suspendedUsers, pendingInvitations } = await loadSpravciData()

  return (
    <SpravciClient
      currentUserId={user.id}
      currentUserRole={user.role}
      activeUsers={activeUsers}
      suspendedUsers={suspendedUsers}
      pendingInvitations={pendingInvitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedAt: inv.invitedAt,
        expiresAt: inv.expiresAt,
        invitedBy: inv.invitedBy,
      }))}
    />
  )
}
