import crypto from 'crypto'
import { AdminRole } from '@prisma/client'
import { prisma } from './prisma'
import { hashPassword } from './auth'

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export async function createInvitation(
  email: string,
  role: AdminRole,
  invitedById: string,
): Promise<{ token: string }> {
  const existing = await prisma.adminUser.findUnique({ where: { email } })
  if (existing) throw new Error('Správce s tímto emailem již existuje.')

  const pending = await prisma.adminInvitation.findFirst({
    where: { email, acceptedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } },
  })
  if (pending) throw new Error('Pozvánka na tento email již čeká na přijetí.')

  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.adminInvitation.create({
    data: { email, role, token, invitedById, expiresAt },
  })

  return { token }
}

export async function acceptInvitation(
  token: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<void> {
  const invitation = await prisma.adminInvitation.findUnique({ where: { token } })

  if (!invitation) throw new Error('Pozvánka neexistuje.')
  if (invitation.acceptedAt) throw new Error('Pozvánka již byla přijata.')
  if (invitation.cancelledAt) throw new Error('Pozvánka byla zrušena.')
  if (invitation.expiresAt < new Date()) throw new Error('Platnost pozvánky vypršela.')

  const existing = await prisma.adminUser.findUnique({ where: { email: invitation.email } })
  if (existing) throw new Error('Účet s tímto emailem již existuje.')

  const passwordHash = await hashPassword(password)

  await prisma.$transaction([
    prisma.adminUser.create({
      data: {
        email: invitation.email,
        passwordHash,
        firstName,
        lastName,
        role: invitation.role,
        status: 'ACTIVE',
        isActive: true,
        invitedById: invitation.invitedById,
        invitedAt: invitation.invitedAt,
      },
    }),
    prisma.adminInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ])
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  await prisma.adminInvitation.update({
    where: { id: invitationId },
    data: { cancelledAt: new Date() },
  })
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Invalidate previous tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt },
  })

  return token
}

export async function usePasswordResetToken(
  token: string,
  newPassword: string,
): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!record) throw new Error('Token neexistuje.')
  if (record.usedAt) throw new Error('Token byl již použit.')
  if (record.expiresAt < new Date()) throw new Error('Platnost tokenu vypršela.')

  const passwordHash = await hashPassword(newPassword)

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])
}
