import { smtpConfigured } from '@/lib/email'
import { EmailOdesilaniClient } from './EmailOdesilaniClient'

export default function EmailOdesilaniPage() {
  const configured = smtpConfigured()

  return (
    <EmailOdesilaniClient
      host={process.env.SMTP_HOST ?? null}
      port={process.env.SMTP_PORT ?? null}
      user={process.env.SMTP_USER ?? null}
      configured={configured}
    />
  )
}
