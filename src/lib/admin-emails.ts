import path from 'path'
import { AdminRole } from '@prisma/client'
import { sendEmail, resolveRecipient } from './email'
import { renderEmailTemplate } from './email-template'
import { prisma } from './prisma'

const ROLE_LABELS: Record<AdminRole, string> = {
  OWNER: 'Majitel',
  ADMIN: 'Administrátor',
  STAFF: 'Obsluha',
}

const LOGO_ATTACHMENT = {
  filename: 'logo-markes.jpg',
  path: path.join(process.cwd(), 'public', 'logo-markes.jpg'),
  cid: 'logo-markes',
  contentType: 'image/jpeg',
}

async function getBranchAndBrand() {
  const [branch, brand] = await Promise.all([
    prisma.branchSettings.findFirst({
      select: { name: true, street: true, zip: true, city: true, email: true, phone1: true, openingHours: true },
    }),
    prisma.brandSettings.findFirst({ select: { primaryColor: true, darkColor: true } }),
  ])
  const branchData = branch ?? { name: 'Branické lahůdkářství', street: '', zip: '', city: '', email: null, phone1: null, openingHours: null }
  const brandData = brand ? { primary: brand.primaryColor, dark: brand.darkColor } : null
  return { branch: branchData, brand: brandData }
}

export async function sendInvitationEmail(
  to: string,
  token: string,
  invitedByName: string,
  invitedByEmail: string,
  role: AdminRole,
): Promise<void> {
  const { branch, brand } = await getBranchAndBrand()
  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:3000'
  const ctaUrl = `${shopUrl}/pozvanka/${token}`
  const roleLabel = ROLE_LABELS[role]

  const html = renderEmailTemplate({
    heading: `Pozvánka do administrace`,
    preheader: `Byli jste pozváni jako ${roleLabel}`,
    bodyHtml: `
      <p style="color:#555;margin:0 0 16px">Dobrý den,</p>
      <p style="color:#555;margin:0 0 16px">
        <strong>${invitedByName}</strong> (${invitedByEmail}) Vás zve do administrace
        <strong>${branch.name}</strong> jako <strong>${roleLabel}</strong>.
      </p>
      <p style="color:#555;margin:0 0 16px">
        Pro dokončení registrace klikněte na tlačítko níže. Odkaz platí 7 dní.
      </p>
    `,
    ctaButton: { text: 'Přijmout pozvánku', url: ctaUrl },
    branch,
    brand,
    logoSrc: 'cid:logo-markes',
  })

  const { to: recipient, subject } = resolveRecipient(
    to,
    `Pozvánka do administrace ${branch.name}`,
  )

  await sendEmail({
    to: recipient,
    subject,
    html,
    attachments: [LOGO_ATTACHMENT],
  })
}

export async function sendPasswordChangedEmail(
  to: string,
  userName: string,
  userEmail: string,
  ipAddress: string,
): Promise<void> {
  const { branch, brand } = await getBranchAndBrand()

  const changedAt = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

  const html = renderEmailTemplate({
    heading: 'Heslo bylo změněno',
    preheader: 'Vaše administrátorské heslo bylo změněno',
    bodyHtml: `
      <p style="color:#555;margin:0 0 16px">Dobrý den ${userName},</p>
      <p style="color:#555;margin:0 0 16px">
        Právě bylo změněno heslo k Vašemu administračnímu účtu (<strong>${userEmail}</strong>).
      </p>
      <p style="color:#555;margin:0 0 16px">
        Pokud jste to neudělal/a Vy, okamžitě kontaktujte správce systému na
        <a href="mailto:info@lahudkybranik.cz" style="color:#333">info@lahudkybranik.cz</a>.
      </p>
      <p style="color:#999;font-size:13px;margin:0">Změna proběhla ${changedAt} z IP adresy ${ipAddress}</p>
    `,
    branch,
    brand,
    logoSrc: 'cid:logo-markes',
  })

  const { to: recipient, subject } = resolveRecipient(
    to,
    `Změna hesla — ${branch.name}`,
  )

  await sendEmail({
    to: recipient,
    subject,
    html,
    attachments: [LOGO_ATTACHMENT],
  })
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  userName: string,
): Promise<void> {
  const { branch, brand } = await getBranchAndBrand()
  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:3000'
  const ctaUrl = `${shopUrl}/reset-hesla/${token}`

  const html = renderEmailTemplate({
    heading: 'Obnovení přístupového hesla',
    preheader: 'Žádost o reset hesla',
    bodyHtml: `
      <p style="color:#555;margin:0 0 16px">Dobrý den ${userName},</p>
      <p style="color:#555;margin:0 0 16px">
        Obdrželi jsme žádost o resetování Vašeho hesla.
        Klikněte na tlačítko níže pro nastavení nového hesla. Odkaz platí 1 hodinu.
      </p>
      <p style="color:#555;margin:0 0 16px">
        Pokud jste o reset nežádali, ignorujte tento email. Heslo zůstane beze změny.
      </p>
    `,
    ctaButton: { text: 'Nastavit nové heslo', url: ctaUrl },
    branch,
    brand,
    logoSrc: 'cid:logo-markes',
  })

  const { to: recipient, subject } = resolveRecipient(
    to,
    `Obnovení hesla — ${branch.name}`,
  )

  await sendEmail({
    to: recipient,
    subject,
    html,
    attachments: [LOGO_ATTACHMENT],
  })
}
