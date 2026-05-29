'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ categoryName: string; revenue: number }>
}

function fmtCZK(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(Math.round(v))
}

export function CategoryRevenueChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-stone-400">Žádná data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={fmtCZK} />
        <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} width={120} />
        <Tooltip formatter={(v: unknown) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(Number(v))} cursor={{ fill: '#f5f5f4' }} />
        <Bar dataKey="revenue" name="Tržby" fill="#3b82f6" radius={[0, 3, 3, 0]} maxBarSize={24} label={{ position: 'right', fontSize: 10, fill: '#78716c', formatter: (v: unknown) => fmtCZK(Number(v)) }} />
      </BarChart>
    </ResponsiveContainer>
  )
}
