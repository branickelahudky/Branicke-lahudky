import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { BranchSettingsClient } from './BranchSettingsClient'
import type { BranchSettingsData } from './actions'

const SEED: BranchSettingsData = {
  name: 'Branické lahůdkářství',
  street: 'Branická 75',
  zip: '14000',
  city: 'Praha',
  country: 'Česká republika',
  email: 'info@lahudkybranik.cz',
  phone1: '731 862 387',
  phone2: '775 182 396',
  managerName: 'Lubomír Markes',
  openingHours: 'Po 10:00 - 17:30\nÚt-Čt 8:30 - 17:30\nPá 8:30 - 17:30\nSo-Ne zavřeno',
}

export default async function ProvozovnaPage() {
  await requireAuth()

  const record = await prisma.branchSettings.findFirst()

  const initial: BranchSettingsData = record
    ? {
        name: record.name,
        street: record.street,
        zip: record.zip,
        city: record.city,
        country: record.country,
        email: record.email,
        phone1: record.phone1,
        phone2: record.phone2,
        managerName: record.managerName,
        openingHours: record.openingHours,
      }
    : SEED

  return <BranchSettingsClient initial={initial} />
}
