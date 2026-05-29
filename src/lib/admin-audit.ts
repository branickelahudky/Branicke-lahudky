import { prisma } from './prisma'

export async function logAdminAction(
  userId: string | null,
  action: string,
  targetUserId?: string | null,
  metadata?: Record<string, unknown> | null,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        userId: userId ?? undefined,
        action,
        targetUserId: targetUserId ?? undefined,
        ipAddress,
        userAgent,
        metadata: metadata ? (metadata as object) : undefined,
      },
    })
  } catch {
    // Audit log failure must never crash the main flow
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  LOGIN: 'Přihlášení',
  LOGIN_FAILED: 'Neúspěšné přihlášení',
  LOGOUT: 'Odhlášení',
  PASSWORD_CHANGED: 'Změna hesla',
  PASSWORD_RESET_REQUESTED: 'Žádost o reset hesla',
  PASSWORD_RESET_USED: 'Reset hesla dokončen',
  USER_INVITED: 'Pozvánka odeslána',
  USER_INVITATION_ACCEPTED: 'Pozvánka přijata',
  USER_INVITATION_CANCELLED: 'Pozvánka zrušena',
  USER_UPDATED: 'Úprava správce',
  USER_ROLE_CHANGED: 'Změna role',
  USER_SUSPENDED: 'Správce zablokován',
  USER_REACTIVATED: 'Správce aktivován',
  SESSION_REVOKED: 'Relace ukončena',
  ALL_SESSIONS_REVOKED: 'Všechny ostatní relace ukončeny',
}
