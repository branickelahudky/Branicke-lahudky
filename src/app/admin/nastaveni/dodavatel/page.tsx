import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { notFound } from 'next/navigation'
import { SupplierSettingsClient } from './SupplierSettingsClient'
import type { SupplierSettingsData } from './actions'

const DEFAULTS: SupplierSettingsData = {
  companyName: 'Lubomír Markes',
  street: '',
  city: '',
  postalCode: '',
  country: 'Česká republika',
  companyId: '61850519',
  vatId: 'CZ6506150244',
  isVatPayer: true,
  bankAccount: '269410328/0300',
  iban: null,
  legalNote: null,
  logoUrl: null,
  invoiceFooterNote: null,
  defaultDueDays: 14,
}

export default async function DodavatelPage() {
  const { user } = await requireAuth()
  if (user.role !== 'OWNER') notFound()

  const record = await prisma.supplierSettings.findFirst()

  const initial: SupplierSettingsData = record
    ? {
        companyName: record.companyName,
        street: record.street,
        city: record.city,
        postalCode: record.postalCode,
        country: record.country,
        companyId: record.companyId,
        vatId: record.vatId,
        isVatPayer: record.isVatPayer,
        bankAccount: record.bankAccount,
        iban: record.iban,
        legalNote: record.legalNote,
        logoUrl: record.logoUrl,
        invoiceFooterNote: record.invoiceFooterNote,
        defaultDueDays: record.defaultDueDays,
      }
    : DEFAULTS

  return <SupplierSettingsClient initial={initial} />
}
