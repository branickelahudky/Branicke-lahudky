import { OrderStatus } from '@prisma/client'

export const INVALID_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED']

function getPragueOffsetMs(date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const pragueStr = date.toLocaleString('en-US', { timeZone: 'Europe/Prague' })
  return new Date(pragueStr).getTime() - new Date(utcStr).getTime()
}

export function pragueCurrentYear(): number {
  return parseInt(
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric' }).format(new Date())
  )
}

export function pragueStartOfYear(year: number): Date {
  const date = new Date(Date.UTC(year, 0, 1))
  return new Date(date.getTime() - getPragueOffsetMs(date))
}

export function pragueStartOfDay(offsetDays = 0): Date {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Prague',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const y = parseInt(parts.find(p => p.type === 'year')!.value)
  const m = parseInt(parts.find(p => p.type === 'month')!.value) - 1
  const d = parseInt(parts.find(p => p.type === 'day')!.value)
  const date = new Date(Date.UTC(y, m, d + offsetDays))
  return new Date(date.getTime() - getPragueOffsetMs(date))
}

export function pragueMonthOf(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', month: 'numeric' }).format(date)
  )
}

export function pragueDayOfWeek(date: Date): number {
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', weekday: 'long' }).format(date)
  const map: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }
  return map[dayName] ?? 0
}

export function pragueHourOf(date: Date): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', hour: 'numeric', hour12: false }).format(date)
  return parseInt(s) % 24
}
