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
