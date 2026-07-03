// Obnova hesla zákazníka: vytvoření časově omezeného tokenu + odeslání
// e-mailu v brand šabloně. Respektuje EMAIL_TEST_MODE (resolveRecipient).
// Stejný flow slouží i k nastavení hesla u účtů importovaných ze Shoptetu.

import path from 'path'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, resolveRecipient } from '@/lib/email'
import { renderEmailTemplate, type BranchForTemplate } from '@/lib/email-template'

const TOKEN_TTL_MINUTES = 60

const LOGO_ATTACHMENT = {
  filename: 'logo-markes.jpg',
  path: path.join(process.cwd(), 'public', 'logo-markes.jpg'),
  cid: 'logo-markes',
  contentType: 'image/jpeg',
}

const BRANCH_FALLBACK: BranchForTemplate = {
  name: 'Branické lahůdkářství',
  street: 'Branická 75',
  zip: '14000',
  city: 'Praha',
  email: 'info@lahudkybranik.cz',
  phone1: null,
}

/**
 * Vytvoří reset token a pošle zákazníkovi e-mail s odkazem.
 * `claimAccount` = účet existuje bez hesla (import ze Shoptetu) — jiný text.
 */
export async function sendCustomerPasswordResetEmail(
  customerId: string,
  options?: { claimAccount?: boolean },
): Promise<{ sent: boolean; error?: string }> {
  const [customer, branch, brandDb] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
    prisma.branchSettings.findFirst({
      select: { name: true, street: true, zip: true, city: true, email: true, phone1: true, openingHours: true },
    }),
    prisma.brandSettings.findFirst({ select: { primaryColor: true, darkColor: true } }),
  ])
  if (!customer) return { sent: false, error: 'Zákazník nenalezen.' }

  const token = crypto.randomBytes(32).toString('base64url')
  await prisma.customerPasswordResetToken.create({
    data: {
      token,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    },
  })

  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:3000'
  const resetUrl = `${shopUrl}/ucet/obnova-hesla?t=${token}`

  const claim = options?.claimAccount ?? false
  const subject = claim ? 'Nastavení hesla k vašemu účtu' : 'Obnova hesla'
  const intro = claim
    ? `Dobrý den ${customer.firstName} ${customer.lastName},<br>váš e-mail známe z prodejny nebo z dřívějších nákupů. Pro přístup k účtu na našem novém e-shopu si prosím nastavte heslo — objednávky a údaje zůstávají u nás v bezpečí.`
    : `Dobrý den ${customer.firstName} ${customer.lastName},<br>přijali jsme žádost o obnovu hesla k vašemu účtu. Nové heslo si nastavíte tlačítkem níže.`

  const html = renderEmailTemplate({
    preheader: subject,
    heading: claim ? 'Nastavte si heslo' : 'Obnova hesla',
    bodyHtml: `
      <p style="margin:0 0 14px;line-height:1.7;color:#333333;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${intro}</p>
      <p style="margin:0 0 14px;line-height:1.7;color:#777777;font-family:Arial,Helvetica,sans-serif;font-size:13px;">Odkaz platí ${TOKEN_TTL_MINUTES} minut. Pokud jste o ${claim ? 'nastavení' : 'obnovu'} hesla nežádali, tento e-mail ignorujte — heslo se nemění.</p>`,
    ctaButton: { text: claim ? 'Nastavit heslo' : 'Obnovit heslo', url: resetUrl },
    branch: branch ?? BRANCH_FALLBACK,
    brand: brandDb ? { primary: brandDb.primaryColor, dark: brandDb.darkColor } : null,
  })

  const resolved = resolveRecipient(customer.email, subject)
  const result = await sendEmail({
    to: resolved.to,
    subject: resolved.subject,
    html,
    attachments: [LOGO_ATTACHMENT],
  })

  await prisma.emailLog.create({
    data: {
      customerId: customer.id,
      recipient: resolved.to,
      subject: resolved.subject,
      status: result.success ? 'sent' : 'failed',
      error: result.error ?? null,
    },
  }).catch(() => {})

  return { sent: result.success, error: result.error }
}

/** Ověří token (platný, nepoužitý). Vrací customerId, nebo null. */
export async function validateCustomerResetToken(token: string): Promise<string | null> {
  const record = await prisma.customerPasswordResetToken.findUnique({ where: { token } })
  if (!record || record.usedAt || record.expiresAt < new Date()) return null
  return record.customerId
}

/** Označí token jako použitý. */
export async function consumeCustomerResetToken(token: string): Promise<void> {
  await prisma.customerPasswordResetToken.update({
    where: { token },
    data: { usedAt: new Date() },
  })
}
