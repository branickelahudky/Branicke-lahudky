import { requireAuth } from '@/lib/auth-roles'
import { seedAndLoadDaneData } from './actions'
import { DaneClient } from './DaneClient'

export default async function DanePage() {
  await requireAuth()

  const { taxSettings, vatRates } = await seedAndLoadDaneData()

  return <DaneClient initialTaxSettings={taxSettings} initialVatRates={vatRates} />
}
