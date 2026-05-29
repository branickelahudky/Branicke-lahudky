'use server'

import { headers } from 'next/headers'
import { AdminRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole, requireAuth } from '@/lib/auth-roles'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { createInvitation, cancelInvitation, createPasswordResetToken } from '@/lib/admin-invitations'
import { logAdminAction } from '@/lib/admin-audit'
import { sendInvitationEmail, sendPasswordResetEmail } from '@/lib/admin-emails'

async function getIpAndAgent() {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? undefined
  const userAgent = h.get('user-agent') ?? undefined
  return { ip, userAgent }
}

export async function loadSpravciData() {
  await requireRole(['OWNER', 'ADMIN'])

  const [activeUsers, suspendedUsers, pendingInvitations] = await Promise.all([
    prisma.adminUser.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, lastLoginAt: true, lastLoginIp: true, createdAt: true, invitedById: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminUser.findMany({
      where: { status: 'SUSPENDED' },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminInvitation.findMany({
      where: { acceptedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { invitedAt: 'desc' },
    }),
  ])

  return { activeUsers, suspendedUsers, pendingInvitations }
}

export async function inviteAdminAction(email: string, role: AdminRole) {
  const { user } = await requireRole(['OWNER', 'ADMIN'])
  const { ip, userAgent } = await getIpAndAgent()

  if (user.role === 'ADMIN' && role === 'OWNER') {
    throw new Error('ADMIN nemůže pozvat OWNERa.')
  }

  const { token } = await createInvitation(email, role, user.id)

  await logAdminAction(user.id, 'USER_INVITED', null, { email, role }, ip, userAgent)

  const invitedByName = `${user.firstName} ${user.lastName}`
  await sendInvitationEmail(email, token, invitedByName, user.email, role).catch(console.error)
}

export async function cancelInvitationAction(invitationId: string) {
  const { user } = await requireRole(['OWNER', 'ADMIN'])
  const { ip, userAgent } = await getIpAndAgent()

  const inv = await prisma.adminInvitation.findUnique({ where: { id: invitationId } })
  if (!inv) throw new Error('Pozvánka nenalezena.')
  if (user.role !== 'OWNER' && inv.invitedById !== user.id) {
    throw new Error('Nemáte oprávnění zrušit tuto pozvánku.')
  }

  await cancelInvitation(invitationId)
  await logAdminAction(user.id, 'USER_INVITATION_CANCELLED', null, { email: inv.email }, ip, userAgent)
}

export async function resendInvitationAction(invitationId: string) {
  const { user } = await requireRole(['OWNER', 'ADMIN'])

  const inv = await prisma.adminInvitation.findUnique({ where: { id: invitationId } })
  if (!inv || inv.acceptedAt || inv.cancelledAt) throw new Error('Pozvánka není aktivní.')

  const invitedByName = `${user.firstName} ${user.lastName}`
  await sendInvitationEmail(inv.email, inv.token, invitedByName, user.email, inv.role).catch(console.error)
}

export async function updateAdminUserAction(userId: string, data: { firstName: string; lastName: string; email: string }) {
  const { user } = await requireAuth()
  const { ip, userAgent } = await getIpAndAgent()

  if (user.id !== userId && user.role !== 'OWNER') {
    throw new Error('Nemáte oprávnění upravit tohoto správce.')
  }

  const emailConflict = await prisma.adminUser.findFirst({
    where: { email: data.email.trim().toLowerCase(), id: { not: userId } },
  })
  if (emailConflict) throw new Error('Email je již používán jiným správcem.')

  await prisma.adminUser.update({
    where: { id: userId },
    data: { firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim().toLowerCase() },
  })

  await logAdminAction(user.id, 'USER_UPDATED', userId, null, ip, userAgent)
}

export async function changeAdminRoleAction(userId: string, newRole: AdminRole) {
  const { user } = await requireRole(['OWNER'])
  const { ip, userAgent } = await getIpAndAgent()

  if (user.id === userId) throw new Error('Nemůžete si změnit roli sami sobě.')

  await prisma.adminUser.update({ where: { id: userId }, data: { role: newRole } })
  await logAdminAction(user.id, 'USER_ROLE_CHANGED', userId, { newRole }, ip, userAgent)
}

export async function suspendAdminAction(userId: string) {
  const { user } = await requireRole(['OWNER'])
  const { ip, userAgent } = await getIpAndAgent()

  if (user.id === userId) throw new Error('Nemůžete zablokovat sami sebe.')

  const target = await prisma.adminUser.findUnique({ where: { id: userId } })
  if (!target) throw new Error('Správce nenalezen.')

  if (target.role === 'OWNER') {
    const ownerCount = await prisma.adminUser.count({ where: { role: 'OWNER', status: 'ACTIVE' } })
    if (ownerCount <= 1) throw new Error('Nelze zablokovat jediného OWNERa.')
  }

  await prisma.adminUser.update({
    where: { id: userId },
    data: { status: 'SUSPENDED', isActive: false },
  })
  // Delete all active sessions of suspended user
  await prisma.adminSession.deleteMany({ where: { adminUserId: userId } })
  await logAdminAction(user.id, 'USER_SUSPENDED', userId, null, ip, userAgent)
}

export async function reactivateAdminAction(userId: string) {
  const { user } = await requireRole(['OWNER'])
  const { ip, userAgent } = await getIpAndAgent()

  await prisma.adminUser.update({
    where: { id: userId },
    data: { status: 'ACTIVE', isActive: true },
  })
  await logAdminAction(user.id, 'USER_REACTIVATED', userId, null, ip, userAgent)
}

export async function resetPasswordRequestAction(userId: string) {
  const { user } = await requireRole(['OWNER', 'ADMIN'])

  const target = await prisma.adminUser.findUnique({ where: { id: userId } })
  if (!target) throw new Error('Správce nenalezen.')

  const token = await createPasswordResetToken(userId)
  const userName = `${target.firstName} ${target.lastName}`
  await sendPasswordResetEmail(target.email, token, userName).catch(console.error)

  await logAdminAction(user.id, 'PASSWORD_RESET_REQUESTED', userId, null)
}

export async function changeOwnPasswordAction(currentPassword: string, newPassword: string) {
  const { user } = await requireAuth()
  const { ip, userAgent } = await getIpAndAgent()

  if (newPassword.length < 8) throw new Error('Heslo musí mít alespoň 8 znaků.')

  const currentUser = await prisma.adminUser.findUnique({ where: { id: user.id } })
  if (!currentUser) throw new Error('Uživatel nenalezen.')

  const valid = await verifyPassword(currentPassword, currentUser.passwordHash)
  if (!valid) throw new Error('Současné heslo není správné.')

  const passwordHash = await hashPassword(newPassword)
  await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } })
  await logAdminAction(user.id, 'PASSWORD_CHANGED', null, null, ip, userAgent)
}

export async function loadAdminUserDetail(userId: string) {
  await requireRole(['OWNER', 'ADMIN'])

  const [adminUser, auditLogs, inviter] = await Promise.all([
    prisma.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        status: true, isActive: true, lastLoginAt: true, lastLoginIp: true,
        createdAt: true, invitedById: true, invitedAt: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.adminUser.findFirst({ where: { invitedUsers: { some: { id: userId } } }, select: { firstName: true, lastName: true, email: true } }),
  ])

  return { adminUser, auditLogs, inviter }
}

export async function loadForgotPasswordData(email: string) {
  const user = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || user.status !== 'ACTIVE') return

  const token = await createPasswordResetToken(user.id)
  const userName = `${user.firstName} ${user.lastName}`
  await sendPasswordResetEmail(user.email, token, userName).catch(console.error)
}
