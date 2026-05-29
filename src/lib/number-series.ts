import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { applyFormat } from './number-format'

export { applyFormat }

// ─── Seed defaults ────────────────────────────────────────────────

const SERIES_SEED: Array<{
  key: string
  name: string
  format: string
  currentYear: number
  currentNumber: number
  yearlyReset: boolean
  isActive: boolean
}> = [
  { key: 'INVOICE',       name: 'Faktury',        format: '{rok}-{poradi:3}',     currentYear: new Date().getFullYear(), currentNumber: 0, yearlyReset: true, isActive: true },
  { key: 'ORDER',         name: 'Objednávky',     format: 'OBJ-{rok}-{poradi:3}', currentYear: new Date().getFullYear(), currentNumber: 0, yearlyReset: true, isActive: true },
  { key: 'CREDIT_NOTE',   name: 'Dobropisy',      format: 'D-{rok}-{poradi:3}',   currentYear: new Date().getFullYear(), currentNumber: 0, yearlyReset: true, isActive: true },
  { key: 'PROFORMA',      name: 'Zálohové f.',    format: 'Z-{rok}-{poradi:3}',   currentYear: new Date().getFullYear(), currentNumber: 0, yearlyReset: true, isActive: true },
  { key: 'DELIVERY_NOTE', name: 'Dodací listy',   format: 'DL-{rok}-{poradi:3}',  currentYear: new Date().getFullYear(), currentNumber: 0, yearlyReset: true, isActive: true },
]

// ─── Seed helper (idempotent) ─────────────────────────────────────

async function ensureSeries(key: string) {
  const existing = await prisma.numberSeries.findUnique({ where: { key } })
  if (existing) return existing

  const seed = SERIES_SEED.find((s) => s.key === key)
  if (!seed) throw new Error(`Neznámá číselná řada: ${key}`)

  return await prisma.numberSeries.create({ data: seed })
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Atomicky zvýší čítač a vrátí naformátované číslo.
 * Serializovatelná transakce zajistí unikátnost i při souběžném přístupu.
 */
export async function generateNextNumber(key: string): Promise<string> {
  return await prisma.$transaction(
    async (tx) => {
      let series = await tx.numberSeries.findUnique({ where: { key } })

      if (!series) {
        const seed = SERIES_SEED.find((s) => s.key === key)
        if (!seed) throw new Error(`Neznámá číselná řada: ${key}`)
        series = await tx.numberSeries.create({ data: seed })
      }

      const nowYear = new Date().getFullYear()
      let year = series.currentYear
      let num = series.currentNumber

      if (series.yearlyReset && year < nowYear) {
        year = nowYear
        num = 0
      }

      num += 1

      await tx.numberSeries.update({
        where: { id: series.id },
        data: { currentYear: year, currentNumber: num },
      })

      return applyFormat(series.format, year, num)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

/**
 * Vrátí náhled příštího čísla BEZ zvýšení čítače (pro UI preview).
 */
export async function peekNextNumber(key: string): Promise<string> {
  const series = await ensureSeries(key)

  const nowYear = new Date().getFullYear()
  let year = series.currentYear
  let num = series.currentNumber

  if (series.yearlyReset && year < nowYear) {
    year = nowYear
    num = 0
  }

  return applyFormat(series.format, year, num + 1)
}

/**
 * Seed všech řad (volá se při načtení stránky nastavení).
 */
export async function seedAllSeries() {
  for (const seed of SERIES_SEED) {
    await prisma.numberSeries.upsert({
      where: { key: seed.key },
      update: {},
      create: seed,
    })
  }
}
