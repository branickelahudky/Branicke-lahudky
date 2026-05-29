import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-roles'
import { getFinanceStats } from '@/lib/stats/finance'

const MONTH_NAMES = ['', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']

export async function GET() {
  await requireRole(['OWNER', 'ADMIN'])
  const stats = await getFinanceStats()

  const rows = [
    ['Měsíc', 'Základ 12 % (Kč)', 'DPH 12 % (Kč)', 'Základ 21 % (Kč)', 'DPH 21 % (Kč)', 'Celkem DPH (Kč)'],
    ...stats.vatByMonth.map(m => [
      MONTH_NAMES[m.month],
      m.base12.toFixed(2),
      m.vat12.toFixed(2),
      m.base21.toFixed(2),
      m.vat21.toFixed(2),
      m.totalVat.toFixed(2),
    ]),
    ['SOUČET',
      stats.vatByMonth.reduce((s, m) => s + m.base12, 0).toFixed(2),
      stats.vatByMonth.reduce((s, m) => s + m.vat12, 0).toFixed(2),
      stats.vatByMonth.reduce((s, m) => s + m.base21, 0).toFixed(2),
      stats.vatByMonth.reduce((s, m) => s + m.vat21, 0).toFixed(2),
      stats.vatByMonth.reduce((s, m) => s + m.totalVat, 0).toFixed(2),
    ],
  ]

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const filename = `dph-prehled-${stats.year}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
