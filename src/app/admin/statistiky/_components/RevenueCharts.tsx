'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart,
} from 'recharts'

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
const DOW_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

function fmtCZK(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(Math.round(v))
}

function CzkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="mb-1 font-medium text-stone-800">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(p.value)}</p>
      ))}
    </div>
  )
}

interface MonthlyProps {
  thisYear: Array<{ month: number; revenue: number; orderCount: number }>
  lastYear: Array<{ month: number; revenue: number }>
}

export function MonthlyRevenueChart({ thisYear, lastYear }: MonthlyProps) {
  const data = MONTH_LABELS.map((label, i) => {
    const m = i + 1
    const ty = thisYear.find(r => r.month === m)
    const ly = lastYear.find(r => r.month === m)
    return {
      label,
      revenue: ty?.revenue ?? 0,
      lastYear: ly?.revenue ?? 0,
      orderCount: ty?.orderCount ?? 0,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={fmtCZK} width={40} />
        <Tooltip content={<CzkTooltip />} cursor={{ fill: '#f5f5f4' }} />
        <Bar dataKey="revenue" name="Letošní rok" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Line dataKey="lastYear" name="Loňský rok" stroke="#94a3b8" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

interface DowProps {
  data: Array<{ day: number; revenue: number; orderCount: number }>
}

export function DayOfWeekChart({ data }: DowProps) {
  const chartData = DOW_LABELS.map((label, i) => {
    const d = data.find(r => r.day === i)
    return { label, revenue: d?.revenue ?? 0, orderCount: d?.orderCount ?? 0 }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={fmtCZK} width={36} />
        <Tooltip content={<CzkTooltip />} cursor={{ fill: '#f5f5f4' }} />
        <Bar dataKey="revenue" name="Tržby" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface HourProps {
  data: Array<{ hour: number; revenue: number; orderCount: number }>
}

export function HourOfDayChart({ data }: HourProps) {
  const chartData = Array.from({ length: 24 }, (_, h) => {
    const d = data.find(r => r.hour === h)
    return { label: `${h}h`, revenue: d?.revenue ?? 0, orderCount: d?.orderCount ?? 0 }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#78716c' }}
          tickLine={false}
          axisLine={false}
          interval={1}
          tickFormatter={(v, i) => (i % 3 === 0 ? v : '')}
        />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={fmtCZK} width={36} />
        <Tooltip content={<CzkTooltip />} cursor={{ fill: '#f5f5f4' }} />
        <Bar dataKey="revenue" name="Tržby" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
