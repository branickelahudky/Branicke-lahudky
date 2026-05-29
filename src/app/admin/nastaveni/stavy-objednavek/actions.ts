'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { OrderStatus } from '@prisma/client'

const PATH = '/admin/nastaveni/stavy-objednavek'

export type StatusConfigData = {
  label: string
  color: string
  sendEmail: boolean
  emailSubject: string | null
  emailHeading: string | null
  emailBody: string | null
  generateInvoice: boolean
  attachInvoice: boolean
  isActive: boolean
}

async function assertAdminOrOwner() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')
  return user
}

export async function updateStatusConfig(status: OrderStatus, data: StatusConfigData) {
  await assertAdminOrOwner()
  if (!data.label.trim()) throw new Error('Název je povinný.')

  await prisma.orderStatusConfig.upsert({
    where: { status },
    create: {
      status,
      label: data.label.trim(),
      color: data.color,
      sendEmail: data.sendEmail,
      emailSubject: data.emailSubject?.trim() || null,
      emailHeading: data.emailHeading?.trim() || null,
      emailBody: data.emailBody?.trim() || null,
      generateInvoice: data.generateInvoice,
      attachInvoice: data.attachInvoice,
      isActive: data.isActive,
    },
    update: {
      label: data.label.trim(),
      color: data.color,
      sendEmail: data.sendEmail,
      emailSubject: data.emailSubject?.trim() || null,
      emailHeading: data.emailHeading?.trim() || null,
      emailBody: data.emailBody?.trim() || null,
      generateInvoice: data.generateInvoice,
      attachInvoice: data.attachInvoice,
      isActive: data.isActive,
    },
  })
  revalidatePath(PATH)
}
