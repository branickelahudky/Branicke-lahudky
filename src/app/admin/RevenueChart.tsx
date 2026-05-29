'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ChartEntry {
  date: string
  revenue: number
  orderCount: number
}

interface Props {
  data: ChartEntry[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: ChartEntry }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-stone-800">{label}</p>
      <p className="text-stone-600">
        {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(entry.revenue)}
      </p>
      <p className="text-stone-500">{entry.orderCount} {entry.orderCount === 1 ? 'objednávka' : entry.orderCount < 5 ? 'objednávky' : 'objednávek'}</p>
    </div>
  )
}

function fmtRevenue(v: number) {
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(Math.round(v))
}

export function RevenueChart({ data }: Props) {
  // Zobrazit každý 5. label na X ose aby se nepřekrývaly
  const tickFormatter = (val: string, idx: number) => (idx % 5 === 0 ? val : '')

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#78716c' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFormatter}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#78716c' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtRevenue}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f5f4' }} />
        <Bar dataKey="revenue" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
