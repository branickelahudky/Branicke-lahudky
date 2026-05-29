import { requireAuth } from '@/lib/auth-roles'
import { loadNumberSeries } from './actions'
import { CiselneRadyClient } from './CiselneRadyClient'

export default async function CiselneRadyPage() {
  const { user } = await requireAuth()
  const series = await loadNumberSeries()

  return <CiselneRadyClient initialSeries={series} isOwner={user.role === 'OWNER'} />
}
