import { requireAuth } from '@/lib/auth-roles'
import { getActiveSessions, getLoginHistory } from './actions'
import { ZabezpeceniClient } from './ZabezpeceniClient'

export default async function ZabezpeceniPage() {
  await requireAuth()

  const [sessions, loginHistory] = await Promise.all([
    getActiveSessions(),
    getLoginHistory(20),
  ])

  return <ZabezpeceniClient sessions={sessions} loginHistory={loginHistory} />
}
