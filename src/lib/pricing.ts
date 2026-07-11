// Cenové výpočty - DPH, váhové produkty, souhrn objednávky
//
// Pravidla:
//  - Vždy počítáme s Decimal jako number (Kč na 2 desetinná místa)
//  - Zaokrouhlujeme až výsledek (per-line), ne mezivýpočty
//  - Pro CZ: potraviny 12 %, doprava/platba 21 %
//  - Pro váhové produkty: cena = váha × cena_za_jednotku

// Type-only import — soubor se používá i v klientských komponentách (pokladna),
// runtime závislost na @prisma/client by rozbila bundle.
import type { Unit } from '@prisma/client'

export const VAT_RATES = {
  FOOD: 12.0, // potraviny od 2024
  STANDARD: 21.0, // doprava, platby, ostatní
  ZERO: 0.0, // knihy apod.
} as const

/**
 * Zaokrouhlení na 2 desetinná místa (Kč).
 * Pozor na float artefakty: 0.1 + 0.2 = 0.30000000000000004
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Vypočítá cenu bez DPH z ceny s DPH.
 */
export function priceWithoutVat(priceWithVat: number, vatRate: number): number {
  return roundMoney(priceWithVat / (1 + vatRate / 100))
}

/**
 * Vypočítá cenu s DPH z ceny bez DPH.
 */
export function priceWithVat(priceWithoutVat: number, vatRate: number): number {
  return roundMoney(priceWithoutVat * (1 + vatRate / 100))
}

/**
 * Vrátí samotnou DPH částku z ceny s DPH.
 */
export function vatAmount(priceWithVat: number, vatRate: number): number {
  return roundMoney(priceWithVat - priceWithoutVat(priceWithVat, vatRate))
}

/**
 * Formátování pro UI: 1234.5 → "1 234,50 Kč"
 */
export function formatCZK(amount: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Pro váhové produkty: spočítá cenu položky podle skutečné navážené váhy.
 *
 * Příklad: NYC Pastrami stojí 600 Kč / 100g.
 *  Zákazník chce 250g → expected = 25000 Kč / 100 = 1500 Kč
 *  Obsluha naváží 247g → actual = 600 × 247/100 = 1482 Kč
 */
export function calculateWeightBasedPrice(
  unitPrice: number,
  unit: Unit,
  weightKg: number
): number {
  switch (unit) {
    case 'KG':
      return roundMoney(unitPrice * weightKg)
    case 'G_100':
      return roundMoney(unitPrice * weightKg * 10) // 1 kg = 10 × 100 g
    case 'L':
      return roundMoney(unitPrice * weightKg) // pro tekutiny použijeme kg ~ l
    case 'ML_100':
      return roundMoney(unitPrice * weightKg * 10)
    case 'KS':
      return roundMoney(unitPrice) // u kusů váha nehraje roli
    default:
      return roundMoney(unitPrice)
  }
}

// ───────────────────────────────────────────────────────────────
// Akční ceny — JEDINÁ logika platnosti pro server i klient.
// Karta, detail, košík i /api/orders se ptají téhle funkce; nikde
// jinde se platnost akce nevyhodnocuje.
// ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

export type SaleFields = {
  isOnSale: boolean
  salePriceWithVat: number | null
  /** Datum se ukládá jako půlnoc UTC (z admin <input type="date">) */
  saleStartsAt?: Date | string | null
  saleEndsAt?: Date | string | null
}

/**
 * Akční cena platí, když isOnSale && salePriceWithVat > 0 && akce už
 * začala && (saleEndsAt je null NEBO ještě neuplynul CELÝ den konce —
 * „platí do 8. 6." znamená včetně 8. 6.).
 */
export function isSaleActive(p: SaleFields, now: Date = new Date()): boolean {
  if (!p.isOnSale || !p.salePriceWithVat || p.salePriceWithVat <= 0) return false
  if (p.saleStartsAt && new Date(p.saleStartsAt).getTime() > now.getTime()) return false
  if (p.saleEndsAt && new Date(p.saleEndsAt).getTime() + DAY_MS <= now.getTime()) return false
  return true
}

/** Aktivní akční cena s DPH, nebo null (prošlá/nezačatá/žádná akce). */
export function activeSalePrice(p: SaleFields, now: Date = new Date()): number | null {
  return isSaleActive(p, now) ? p.salePriceWithVat : null
}

/** Sleva v celých procentech: 59,90 → 39,90 = −33 % */
export function salePercent(priceWithVat: number, salePriceWithVat: number): number {
  if (priceWithVat <= 0) return 0
  return Math.round((1 - salePriceWithVat / priceWithVat) * 100)
}

/** „8. 6." pro štítek „−33 % do 8. 6." (UTC — datum je uložené jako půlnoc UTC) */
export function formatSaleEnd(saleEndsAt: Date | string): string {
  const d = new Date(saleEndsAt)
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`
}

/**
 * Prisma where fragment pro výpisy „jen s AKTIVNÍ akcí" (regál Akce,
 * /akce, filtr onSale). Stejná sémantika jako isSaleActive — konec
 * akce platí včetně celého dne.
 */
export function activeSaleWhere(now: Date = new Date()) {
  return {
    isOnSale: true as const,
    salePriceWithVat: { gt: 0 },
    AND: [
      { OR: [{ saleStartsAt: null }, { saleStartsAt: { lte: now } }] },
      { OR: [{ saleEndsAt: null }, { saleEndsAt: { gt: new Date(now.getTime() - DAY_MS) } }] },
    ],
  }
}

/** Cena za kg pro kusový produkt se známou gramáží (39,90 / 0,26 kg = 153,46) */
export function pricePerKg(priceWithVat: number, weightGrams: number | null | undefined): number | null {
  if (!weightGrams || weightGrams <= 0 || priceWithVat <= 0) return null
  return roundMoney(priceWithVat / (weightGrams / 1000))
}

/** Jednotka zobrazená přímo u částky: „37 Kč / 100 g", „189 Kč / kg", „37 Kč / ks" */
export function priceUnitSuffix(unit: Unit | string): string {
  switch (unit) {
    case 'KG':     return '/ kg'
    case 'G_100':  return '/ 100 g'
    case 'L':      return '/ l'
    case 'ML_100': return '/ 100 ml'
    default:       return '/ ks'
  }
}

/** Váha balení jako jednotka u ceny varianty: 500 → „/ 500 g", 1000 → „/ 1 kg" */
export function packWeightSuffix(weightGrams: number | null | undefined): string | null {
  if (!weightGrams || weightGrams <= 0) return null
  return weightGrams >= 1000
    ? `/ ${(weightGrams / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg`
    : `/ ${weightGrams} g`
}

/**
 * Jednotka u ceny položky — JEDINÉ místo pro detail (zvolená varianta),
 * košík i pokladnu. Varianta je balení → jednotkou je VÁHA VARIANTY
 * („/ 500 g", „/ 1 kg"), nikdy „/ ks"; bez varianty jednotka produktu.
 */
export function itemUnitSuffix(item: {
  unit: Unit | string
  isWeightBased: boolean
  variantId?: string | null
  /** u položky s variantou váha varianty (v košíku už vyřešená) */
  weightGrams?: number | null
}): string {
  if (item.variantId) return packWeightSuffix(item.weightGrams) ?? '/ ks'
  return item.isWeightBased ? priceUnitSuffix(item.unit) : '/ ks'
}

export type UnitPricePerKg = { value: number; per: 'kg' | 'l' }

/**
 * Měrná cena (přepočet na kg/litr) pod hlavní cenou — JEDINÝ výpočet
 * pro detail, kartu i košík:
 *  - G_100 / ML_100 → ×10 („37 Kč / 100 g" → 370 Kč/kg)
 *  - KG / L → null (hlavní cena už měrná JE — neduplikovat)
 *  - kusový se známou gramáží → cena / váha (F20)
 * U aktivní slevy sem patří SLEVOVÁ cena.
 */
export function unitPricePerKg(
  priceWithVat: number,
  unit: Unit | string,
  weightGrams?: number | null,
): UnitPricePerKg | null {
  if (priceWithVat <= 0) return null
  switch (unit) {
    case 'G_100':  return { value: roundMoney(priceWithVat * 10), per: 'kg' }
    case 'ML_100': return { value: roundMoney(priceWithVat * 10), per: 'l' }
    case 'KG':
    case 'L':      return null
    default: {
      const perKg = pricePerKg(priceWithVat, weightGrams)
      return perKg !== null ? { value: perKg, per: 'kg' } : null
    }
  }
}

/** „370 Kč/kg" */
export function formatUnitPrice(p: UnitPricePerKg): string {
  return `${p.value.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Kč/${p.per}`
}

// ───────────────────────────────────────────────────────────────
// Souhrn objednávky
// ───────────────────────────────────────────────────────────────

export interface OrderLineInput {
  quantity: number
  unitPriceWithVat: number
  vatRate: number
  /** Pro váhové produkty: skutečná navážená váha v kg */
  actualWeightKg?: number
  unit?: Unit
}

export interface OrderTotals {
  subtotalWithoutVat: number
  subtotalWithVat: number
  shippingWithoutVat: number
  shippingWithVat: number
  paymentFeeWithoutVat: number
  paymentFeeWithVat: number
  discountAmount: number
  totalVat: number
  totalWithoutVat: number
  totalWithVat: number
  /** Rozpis DPH po sazbách - povinný údaj na faktuře */
  vatBreakdown: Record<number, { base: number; vat: number }>
}

export interface CalculateTotalsInput {
  lines: OrderLineInput[]
  shippingPriceWithVat?: number
  shippingVatRate?: number
  paymentFeeWithVat?: number
  paymentFeeVatRate?: number
  discountAmount?: number
}

/**
 * Spočítá kompletní souhrn objednávky včetně rozpisu DPH po sazbách.
 * Vrací zaokrouhlené hodnoty připravené k uložení do DB i k zobrazení.
 */
export function calculateOrderTotals(input: CalculateTotalsInput): OrderTotals {
  const vatBreakdown: Record<number, { base: number; vat: number }> = {}

  let subtotalWithoutVat = 0
  let subtotalWithVat = 0

  // Řádky zboží
  for (const line of input.lines) {
    let lineTotalWithVat: number

    if (line.actualWeightKg !== undefined && line.unit) {
      lineTotalWithVat = calculateWeightBasedPrice(
        line.unitPriceWithVat,
        line.unit,
        line.actualWeightKg
      )
    } else {
      lineTotalWithVat = roundMoney(line.unitPriceWithVat * line.quantity)
    }

    const lineWithoutVat = priceWithoutVat(lineTotalWithVat, line.vatRate)
    const lineVat = roundMoney(lineTotalWithVat - lineWithoutVat)

    subtotalWithoutVat += lineWithoutVat
    subtotalWithVat += lineTotalWithVat

    vatBreakdown[line.vatRate] ??= { base: 0, vat: 0 }
    vatBreakdown[line.vatRate].base = roundMoney(vatBreakdown[line.vatRate].base + lineWithoutVat)
    vatBreakdown[line.vatRate].vat = roundMoney(vatBreakdown[line.vatRate].vat + lineVat)
  }

  // Doprava
  const shippingWithVat = roundMoney(input.shippingPriceWithVat ?? 0)
  const shippingVatRate = input.shippingVatRate ?? VAT_RATES.STANDARD
  const shippingWithoutVat = priceWithoutVat(shippingWithVat, shippingVatRate)
  if (shippingWithVat > 0) {
    vatBreakdown[shippingVatRate] ??= { base: 0, vat: 0 }
    vatBreakdown[shippingVatRate].base = roundMoney(
      vatBreakdown[shippingVatRate].base + shippingWithoutVat
    )
    vatBreakdown[shippingVatRate].vat = roundMoney(
      vatBreakdown[shippingVatRate].vat + (shippingWithVat - shippingWithoutVat)
    )
  }

  // Platební poplatek
  const paymentFeeWithVat = roundMoney(input.paymentFeeWithVat ?? 0)
  const paymentFeeVatRate = input.paymentFeeVatRate ?? VAT_RATES.STANDARD
  const paymentFeeWithoutVat = priceWithoutVat(paymentFeeWithVat, paymentFeeVatRate)
  if (paymentFeeWithVat > 0) {
    vatBreakdown[paymentFeeVatRate] ??= { base: 0, vat: 0 }
    vatBreakdown[paymentFeeVatRate].base = roundMoney(
      vatBreakdown[paymentFeeVatRate].base + paymentFeeWithoutVat
    )
    vatBreakdown[paymentFeeVatRate].vat = roundMoney(
      vatBreakdown[paymentFeeVatRate].vat + (paymentFeeWithVat - paymentFeeWithoutVat)
    )
  }

  const discountAmount = roundMoney(input.discountAmount ?? 0)

  const totalWithoutVat = roundMoney(
    subtotalWithoutVat + shippingWithoutVat + paymentFeeWithoutVat - discountAmount
  )
  const totalWithVat = roundMoney(
    subtotalWithVat + shippingWithVat + paymentFeeWithVat - discountAmount
  )
  const totalVat = roundMoney(totalWithVat - totalWithoutVat)

  return {
    subtotalWithoutVat: roundMoney(subtotalWithoutVat),
    subtotalWithVat: roundMoney(subtotalWithVat),
    shippingWithoutVat,
    shippingWithVat,
    paymentFeeWithoutVat,
    paymentFeeWithVat,
    discountAmount,
    totalVat,
    totalWithoutVat,
    totalWithVat,
    vatBreakdown,
  }
}

/**
 * Vygeneruje další číslo objednávky ve formátu YY######
 * např. 26000123
 */
export function generateOrderNumber(sequence: number): string {
  const year = new Date().getFullYear().toString().slice(-2)
  return `${year}${sequence.toString().padStart(6, '0')}`
}
