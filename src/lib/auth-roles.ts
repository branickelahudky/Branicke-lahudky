import { redirect } from 'next/navigation'
import { AdminRole } from '@prisma/client'
import { getSession } from './auth'

export type AdminSession = NonNullable<Awaited<ReturnType<typeof getSession>>>

export async function requireAuth(): Promise<AdminSession> {
  const session = await getSession()
  if (!session) redirect('/prihlaseni-admin')
  return session
}

export async function requireRole(allowedRoles: AdminRole[]): Promise<AdminSession> {
  const session = await requireAuth()
  if (!allowedRoles.includes(session.user.role)) redirect('/admin')
  return session
}

export function hasPermission(role: AdminRole, allowedRoles: AdminRole[]): boolean {
  return allowedRoles.includes(role)
}
