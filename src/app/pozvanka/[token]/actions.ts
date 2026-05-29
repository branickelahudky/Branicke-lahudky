'use server'

import { acceptInvitation as acceptInv } from '@/lib/admin-invitations'
import { logAdminAction } from '@/lib/admin-audit'
import { prisma } from '@/lib/prisma'

export async function acceptInvitationAction(
  token: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<void> {
  await acceptInv(token, firstName, lastName, password)

  // Log the acceptance
  const user = await prisma.adminUser.findFirst({ where: { invitedAt: { not: null } }, orderBy: { createdAt: 'desc' } })
  if (user) {
    await logAdminAction(user.id, 'USER_INVITATION_ACCEPTED', null, null)
  }
}
