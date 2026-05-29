'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

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

interface Props {
  data: Array<{ month: number; invoiced: number; paid: number }>
}

export function CashFlowChart({ data }: Props) {
  const chartData = MONTH_LABELS.map((label, i) => {
    const m = i + 1
    const d = data.find(r => r.month === m)
    return { label, invoiced: d?.invoiced ?? 0, paid: d?.paid ?? 0 }
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={fmtCZK} width={40} />
        <Tooltip content={<CzkTooltip />} cursor={{ fill: '#f5f5f4' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="invoiced" name="Vyfakturováno" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={18} />
        <Bar dataKey="paid" name="Zaplaceno" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
