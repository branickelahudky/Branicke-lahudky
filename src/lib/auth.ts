import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import crypto from 'crypto'

const COOKIE_NAME = 'admin_session'
const SESSION_DAYS = 7
const BCRYPT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export async function createSession(
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.adminSession.create({
    data: { token, adminUserId, expiresAt, ipAddress, userAgent },
  })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })

  return token
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { adminUser: true },
  })

  if (!session) return null

  if (session.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { token } }).catch(() => {})
    return null
  }

  if (!session.adminUser.isActive || session.adminUser.status !== 'ACTIVE') return null

  return { user: session.adminUser, session }
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token) {
    await prisma.adminSession.delete({ where: { token } }).catch(() => {})
  }
  cookieStore.delete(COOKIE_NAME)
}
