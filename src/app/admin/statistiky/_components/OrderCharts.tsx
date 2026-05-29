'use client'

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

function fmtCZK(v: number) {
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(Math.round(v))
}

interface MonthlyProps {
  data: Array<{ month: number; orderCount: number; revenue: number; aov: number }>
}

export function MonthlyOrdersChart({ data }: MonthlyProps) {
  const chartData = MONTH_LABELS.map((label, i) => {
    const m = i + 1
    const d = data.find(r => r.month === m)
    return { label, orderCount: d?.orderCount ?? 0, aov: d?.aov ?? 0 }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} width={30} />
        <Tooltip cursor={{ fill: '#f5f5f4' }} />
        <Bar dataKey="orderCount" name="Objednávky" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AovTrendChart({ data }: MonthlyProps) {
  const chartData = MONTH_LABELS.map((label, i) => {
    const m = i + 1
    const d = data.find(r => r.month === m)
    return { label, aov: d?.aov ?? 0 }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={fmtCZK} width={36} />
        <Tooltip formatter={(v: unknown) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(Number(v))} />
        <Line dataKey="aov" name="AOV" stroke="#3b82f6" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}

const COLORS = ['#3b82f6', '#94a3b8']

interface PieProps {
  a: { label: string; value: number }
  b: { label: string; value: number }
}

export function TwoPieChart({ a, b }: PieProps) {
  const total = a.value + b.value
  if (total === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-stone-400">Žádná data</div>
  }
  const data = [
    { name: a.label, value: a.value },
    { name: b.label, value: b.value },
  ]

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false} fontSize={11}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: unknown) => { const n = Number(v); return `${n} (${total > 0 ? Math.round(n / total * 100) : 0}%)` }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
