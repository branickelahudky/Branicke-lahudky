'use server'

import { requireAuth } from '@/lib/auth-roles'
import { verifyConnection, sendEmail } from '@/lib/email'

async function assertAdminOrOwner() {
  const { user } = await requireAuth()
  if (user.role === 'STAFF') throw new Error('Nedostatečná oprávnění.')
  return user
}

export async function testEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  await assertAdminOrOwner()
  return verifyConnection()
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  await assertAdminOrOwner()
  if (!to || !to.includes('@')) throw new Error('Neplatná emailová adresa.')

  const result = await sendEmail({
    to,
    subject: 'Test email – Branické lahůdkářství',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1c1917; margin-bottom: 12px;">Testovací email</h2>
        <p style="color: #57534e; line-height: 1.6;">
          Toto je testovací email. Pokud ho vidíte, odesílání funguje! 🎉
        </p>
        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 12px;">
          Branické lahůdkářství – info@lahudkybranik.cz
        </p>
      </div>
    `,
    text: 'Toto je testovací email. Pokud ho vidíte, odesílání funguje!',
  })

  return result
}
