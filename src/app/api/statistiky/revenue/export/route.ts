import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-roles'
import { getRevenueStats } from '@/lib/stats/revenue'

const MONTH_NAMES = ['', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']

export async function GET() {
  await requireRole(['OWNER', 'ADMIN'])
  const stats = await getRevenueStats()

  const rows = [
    ['Měsíc', 'Tržby (Kč)', 'Počet objednávek', 'AOV (Kč)', `Tržby ${stats.year - 1} (Kč)`],
    ...stats.byMonth.map(m => {
      const ly = stats.lastYearByMonth.find(r => r.month === m.month)
      const aov = m.orderCount > 0 ? (m.revenue / m.orderCount).toFixed(2) : '0'
      return [MONTH_NAMES[m.month], m.revenue.toFixed(2), m.orderCount, aov, (ly?.revenue ?? 0).toFixed(2)]
    }),
  ]

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const filename = `trzby-${stats.year}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
