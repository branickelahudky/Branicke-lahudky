'use server'

import path from 'path'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { sendEmail, resolveRecipient } from '@/lib/email'
import { renderOrderStatusEmail } from '@/lib/order-email'

export type BrandSettingsData = {
  primaryColor: string
  darkColor: string
}

export async function loadEmailSablonyData(): Promise<{
  brand: BrandSettingsData
  previewHtml: string
}> {
  await requireAuth()

  const [branch, brandDb] = await Promise.all([
    prisma.branchSettings.findFirst({
      select: { name: true, street: true, zip: true, city: true, email: true, phone1: true, openingHours: true },
    }),
    prisma.brandSettings.findFirst({ select: { primaryColor: true, darkColor: true } }),
  ])

  const brand: BrandSettingsData = {
    primaryColor: brandDb?.primaryColor ?? '#C9A961',
    darkColor: brandDb?.darkColor ?? '#0a0a0a',
  }

  const branchData = branch ?? {
    name: 'Branické lahůdkářství',
    street: 'Branická 75',
    zip: '14000',
    city: 'Praha',
    email: 'info@lahudkybranik.cz',
    phone1: '731 862 387',
    openingHours: 'Po 10:00 - 17:30\nÚt-Čt 8:30 - 17:30\nPá 8:30 - 17:30\nSo-Ne zavřeno',
  }

  const { html: previewHtml } = renderOrderStatusEmail(
    {
      emailSubject: 'Vaše objednávka OBJ-2026-001 je připravena',
      emailHeading: 'Vaše objednávka je připravena k vyzvednutí',
      emailBody:
        'Dobrý den, Jano Nováková,\n\nVaše objednávka č. OBJ-2026-001 je připravena k vyzvednutí na naší provozovně.\n\nTěšíme se na Vaši návštěvu!',
    },
    {
      orderNumber: 'OBJ-2026-001',
      contactFirstName: 'Jana',
      contactLastName: 'Nováková',
      totalWithVat: 487.5,
      trackingNumber: null,
      trackingUrl: null,
      items: [
        { productName: 'Šunka výběrová', variantName: '200 g', quantity: 1, unit: 'KS', lineTotalWithVat: 89.9 },
        { productName: 'Sýr Eidam 30%', variantName: '150 g', quantity: 1, unit: 'KS', lineTotalWithVat: 54.9 },
        { productName: 'Uzené koleno', variantName: null, quantity: 0.45, unit: 'KG', lineTotalWithVat: 179.1 },
        { productName: 'Domácí paštika', variantName: 'hrubá', quantity: 2, unit: 'KS', lineTotalWithVat: 163.6 },
      ],
    },
    branchData,
    { primary: brand.primaryColor, dark: brand.darkColor },
    '/logo-markes.jpg',  // public URL pro browser preview
  )

  return { brand, previewHtml }
}

export async function updateBrandSettings(data: BrandSettingsData) {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Brand nastavení může měnit pouze správce nebo majitel.')

  if (!data.primaryColor.match(/^#[0-9a-fA-F]{6}$/)) throw new Error('Neplatná hlavní barva (formát: #RRGGBB).')
  if (!data.darkColor.match(/^#[0-9a-fA-F]{6}$/)) throw new Error('Neplatná tmavá barva (formát: #RRGGBB).')

  const existing = await prisma.brandSettings.findFirst({ select: { id: true } })
  const payload = { primaryColor: data.primaryColor, darkColor: data.darkColor }

  if (existing) {
    await prisma.brandSettings.update({ where: { id: existing.id }, data: payload })
  } else {
    await prisma.brandSettings.create({ data: payload })
  }

  revalidatePath('/admin/nastaveni/emaily-sablony')
}

export async function sendPreviewEmail(): Promise<{ success: boolean; error?: string }> {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')

  const [branch, brandDb] = await Promise.all([
    prisma.branchSettings.findFirst({
      select: { name: true, street: true, zip: true, city: true, email: true, phone1: true, openingHours: true },
    }),
    prisma.brandSettings.findFirst({ select: { primaryColor: true, darkColor: true } }),
  ])

  const branchData = branch ?? {
    name: 'Branické lahůdkářství',
    street: 'Branická 75',
    zip: '14000',
    city: 'Praha',
    email: 'info@lahudkybranik.cz',
    phone1: '731 862 387',
    openingHours: 'Po 10:00 - 17:30\nÚt-Čt 8:30 - 17:30\nPá 8:30 - 17:30\nSo-Ne zavřeno',
  }

  const brand = brandDb
    ? { primary: brandDb.primaryColor, dark: brandDb.darkColor }
    : null

  const { subject, html } = renderOrderStatusEmail(
    {
      emailSubject: '[NÁHLED] Vaše objednávka OBJ-2026-001 je připravena',
      emailHeading: 'Vaše objednávka je připravena k vyzvednutí',
      emailBody:
        'Dobrý den, Jano Nováková,\n\nVaše objednávka č. OBJ-2026-001 je připravena k vyzvednutí na naší provozovně.\n\nTěšíme se na Vaši návštěvu!',
    },
    {
      orderNumber: 'OBJ-2026-001',
      contactFirstName: 'Jana',
      contactLastName: 'Nováková',
      totalWithVat: 487.5,
      trackingNumber: null,
      trackingUrl: null,
      items: [
        { productName: 'Šunka výběrová', variantName: '200 g', quantity: 1, unit: 'KS', lineTotalWithVat: 89.9 },
        { productName: 'Sýr Eidam 30%', variantName: '150 g', quantity: 1, unit: 'KS', lineTotalWithVat: 54.9 },
        { productName: 'Uzené koleno', variantName: null, quantity: 0.45, unit: 'KG', lineTotalWithVat: 179.1 },
        { productName: 'Domácí paštika', variantName: 'hrubá', quantity: 2, unit: 'KS', lineTotalWithVat: 163.6 },
      ],
    },
    branchData,
    brand,
  )

  const logoPath = path.join(process.cwd(), 'public', 'logo-markes.jpg')
  const to = user.email
  const resolved = resolveRecipient(to, subject)

  return sendEmail({
    to: resolved.to,
    subject: resolved.subject,
    html,
    attachments: [
      { filename: 'logo-markes.jpg', path: logoPath, cid: 'logo-markes', contentType: 'image/jpeg' },
    ],
  })
}
