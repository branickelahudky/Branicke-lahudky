import nodemailer from 'nodemailer'

export type EmailAttachment = {
  filename: string
  content?: Buffer | string
  path?: string
  cid?: string
  contentType?: string
}

export type SendEmailOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
}

export type SendEmailResult = {
  success: boolean
  messageId?: string
  error?: string
}

function createTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '465', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transporter = createTransporter()
  if (!transporter) {
    return { success: false, error: 'SMTP není nakonfigurováno (chybí ENV proměnné).' }
  }

  try {
    const info = await transporter.sendMail({
      from: `Branické lahůdkářství <${process.env.SMTP_USER}>`,
      to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    })
    return { success: true, messageId: info.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email] sendEmail failed:', msg)
    return { success: false, error: msg }
  }
}

export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  const transporter = createTransporter()
  if (!transporter) {
    return { ok: false, error: 'SMTP není nakonfigurováno (chybí ENV proměnné).' }
  }

  try {
    await transporter.verify()
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email] verifyConnection failed:', msg)
    return { ok: false, error: msg }
  }
}

export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

// Vrátí skutečného příjemce a subject s ohledem na test mode.
// EMAIL_TEST_MODE=true → přesměruje vše na SMTP_USER, označí subject.
export function resolveRecipient(
  to: string,
  subject: string,
): { to: string; subject: string } {
  const testMode = process.env.EMAIL_TEST_MODE !== 'false'
  if (testMode) {
    const redirect = process.env.SMTP_USER ?? 'info@lahudkybranik.cz'
    return {
      to: redirect,
      subject: `[TEST → ${to}] ${subject}`,
    }
  }
  return { to, subject }
}
