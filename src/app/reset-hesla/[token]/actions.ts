'use server'

import { usePasswordResetToken as usePwdToken } from '@/lib/admin-invitations'
import { logAdminAction } from '@/lib/admin-audit'
import { prisma } from '@/lib/prisma'

export async function usePasswordResetTokenAction(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })
  await usePwdToken(token, newPassword)
  if (record) {
    await logAdminAction(record.userId, 'PASSWORD_RESET_USED', null, null)
  }
}
