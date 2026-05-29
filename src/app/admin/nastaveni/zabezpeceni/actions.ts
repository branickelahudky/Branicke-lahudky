'use server'

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { logAdminAction } from '@/lib/admin-audit'
import { sendPasswordChangedEmail } from '@/lib/admin-emails'

async function getCurrentIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
}

export async function changeOwnPasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { user, session } = await requireAuth()
  const ip = await getCurrentIp()

  if (newPassword.length < 8) throw new Error('Heslo musí mít alespoň 8 znaků.')
  if (!/[0-9A-Z]/.test(newPassword)) throw new Error('Heslo musí obsahovat alespoň jednu číslici nebo velké písmeno.')
  if (newPassword === currentPassword) throw new Error('Nové heslo se musí lišit od současného.')

  const currentUser = await prisma.adminUser.findUnique({ where: { id: user.id } })
  if (!currentUser) throw new Error('Uživatel nenalezen.')

  const valid = await verifyPassword(currentPassword, currentUser.passwordHash)
  if (!valid) throw new Error('Současné heslo není správné.')

  const passwordHash = await hashPassword(newPassword)
  await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } })
  await logAdminAction(user.id, 'PASSWORD_CHANGED', null, null, ip, session.userAgent ?? undefined)

  sendPasswordChangedEmail(
    currentUser.email,
    `${currentUser.firstName} ${currentUser.lastName}`,
    currentUser.email,
    ip,
  ).catch(console.error)
}

export type LoginHistoryEntry = {
  id: string
  action: string
  createdAt: Date
  ipAddress: string | null
  userAgent: string | null
  metadata: unknown
}

export async function getLoginHistory(limit = 20): Promise<LoginHistoryEntry[]> {
  const { user } = await requireAuth()

  return prisma.adminAuditLog.findMany({
    where: {
      userId: user.id,
      action: { in: ['LOGIN', 'LOGIN_FAILED'] },
    },
    select: { id: true, action: true, createdAt: true, ipAddress: true, userAgent: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export type ActiveSession = {
  id: string
  createdAt: Date
  ipAddress: string | null
  userAgent: string | null
  isCurrent: boolean
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const { user, session: currentSession } = await requireAuth()

  const sessions = await prisma.adminSession.findMany({
    where: {
      adminUserId: user.id,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, createdAt: true, ipAddress: true, userAgent: true },
    orderBy: { createdAt: 'desc' },
  })

  return sessions.map((s) => ({
    ...s,
    isCurrent: s.id === currentSession.id,
  }))
}

export async function revokeSessionAction(sessionId: string): Promise<void> {
  const { user, session: currentSession } = await requireAuth()
  const ip = await getCurrentIp()

  if (sessionId === currentSession.id) throw new Error('Nemůžete ukončit aktuální relaci.')

  const target = await prisma.adminSession.findUnique({ where: { id: sessionId } })
  if (!target) throw new Error('Relace nenalezena.')
  if (target.adminUserId !== user.id) throw new Error('Nemáte oprávnění ukončit tuto relaci.')

  await prisma.adminSession.delete({ where: { id: sessionId } })
  await logAdminAction(user.id, 'SESSION_REVOKED', null, { sessionId }, ip, currentSession.userAgent ?? undefined)
}

export async function revokeAllOtherSessionsAction(): Promise<void> {
  const { user, session: currentSession } = await requireAuth()
  const ip = await getCurrentIp()

  await prisma.$transaction([
    prisma.adminSession.deleteMany({
      where: {
        adminUserId: user.id,
        id: { not: currentSession.id },
      },
    }),
  ])

  await logAdminAction(user.id, 'ALL_SESSIONS_REVOKED', null, null, ip, currentSession.userAgent ?? undefined)
}
