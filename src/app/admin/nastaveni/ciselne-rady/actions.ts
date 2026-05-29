'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { seedAllSeries } from '@/lib/number-series'

export type SerializedSeries = {
  id: string
  key: string
  name: string
  format: string
  currentYear: number
  currentNumber: number
  yearlyReset: boolean
  isActive: boolean
}

export type NumberSeriesUpdateData = {
  name: string
  format: string
  currentYear: number
  currentNumber: number
  yearlyReset: boolean
  isActive: boolean
}

export async function loadNumberSeries(): Promise<SerializedSeries[]> {
  await requireAuth()
  await seedAllSeries()

  const series = await prisma.numberSeries.findMany({
    orderBy: [
      { isActive: 'desc' },
      { key: 'asc' },
    ],
  })

  // Vrátit v pořadí: INVOICE, ORDER, CREDIT_NOTE, PROFORMA, DELIVERY_NOTE
  const ORDER = ['INVOICE', 'ORDER', 'CREDIT_NOTE', 'PROFORMA', 'DELIVERY_NOTE']
  series.sort((a, b) => {
    const ai = ORDER.indexOf(a.key)
    const bi = ORDER.indexOf(b.key)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return series.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    format: s.format,
    currentYear: s.currentYear,
    currentNumber: s.currentNumber,
    yearlyReset: s.yearlyReset,
    isActive: s.isActive,
  }))
}

export async function updateNumberSeries(id: string, data: NumberSeriesUpdateData) {
  const { user } = await requireAuth()
  if (user.role !== 'OWNER') throw new Error('Číselné řady může měnit pouze majitel.')

  if (!data.name.trim()) throw new Error('Název je povinný.')
  if (!data.format.trim()) throw new Error('Formát je povinný.')
  if (data.currentNumber < 0) throw new Error('Čítač nemůže být záporný.')
  if (data.currentYear < 2020 || data.currentYear > 2099) throw new Error('Rok musí být 2020–2099.')

  await prisma.numberSeries.update({
    where: { id },
    data: {
      name: data.name.trim(),
      format: data.format.trim(),
      currentYear: data.currentYear,
      currentNumber: data.currentNumber,
      yearlyReset: data.yearlyReset,
      isActive: data.isActive,
    },
  })

  revalidatePath('/admin/nastaveni/ciselne-rady')
}
