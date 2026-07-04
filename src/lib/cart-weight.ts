// Výpočet celkové hmotnosti košíku/objednávky pro dopravu.
// Čistá funkce bez závislostí — používá ji serverové API (zdroj pravdy,
// váhy z DB) i pokladna v prohlížeči (odhad z dat v košíku).
//
// Priorita hmotnosti položky:
//  a) váhový produkt (isWeightBased): objednané množství = hmotnost
//     (dle jednotky: KG → qty kg, G_100 → qty × 100 g, obdobně L/ML_100)
//  b) položka s variantou: hmotnost varianty; když ji varianta nemá,
//     spadne to na hmotnost produktu (weightGrams se předává už vyřešený)
//  c) kusový produkt: hmotnost produktu
//  d) nic není vyplněno → výchozí hmotnost položky

/** Výchozí hmotnost kusové položky bez vyplněné váhy (bezpečný odhad). */
export const DEFAULT_ITEM_WEIGHT_GRAMS = 500

export type CartWeightItem = {
  quantity: number
  isWeightBased: boolean
  /** Prisma Unit jako string: 'KS' | 'KG' | 'G_100' | 'L' | 'ML_100' */
  unit: string
  /** Hmotnost JEDNÉ jednotky v gramech — u varianty její váha, jinak váha
   *  produktu; null = nevyplněno (použije se výchozí) */
  weightGrams: number | null
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Hmotnost jedné položky (celý řádek, tj. × quantity) v kg. */
export function calculateItemWeightKg(
  item: CartWeightItem,
  defaultItemWeightGrams: number = DEFAULT_ITEM_WEIGHT_GRAMS,
): number {
  // a) váhový produkt — objednané množství JE hmotnost
  if (item.isWeightBased) {
    switch (item.unit) {
      case 'KG':
      case 'L':
        return round3(item.quantity)
      case 'G_100':
      case 'ML_100':
        return round3(item.quantity * 0.1)
      // KS s isWeightBased nedává smysl — spadne na váhu níže
    }
  }

  // b) + c) hmotnost jednotky (varianta → produkt), d) výchozí
  const grams = item.weightGrams ?? defaultItemWeightGrams
  return round3((grams / 1000) * item.quantity)
}

/** Celková hmotnost košíku v kg. */
export function calculateCartWeightKg(
  items: CartWeightItem[],
  defaultItemWeightGrams: number = DEFAULT_ITEM_WEIGHT_GRAMS,
): number {
  return round3(
    items.reduce((sum, i) => sum + calculateItemWeightKg(i, defaultItemWeightGrams), 0),
  )
}

/** Formátování pro UI: 4.9 → "4,9 kg" */
export function formatWeightKg(kg: number): string {
  return `${kg.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })} kg`
}

// ───────────────────────────────────────────────────────────────
// Cena dopravy podle váhových pásem (Cool Balík)
// Sdílené server (zdroj pravdy) + pokladna UI.
// ───────────────────────────────────────────────────────────────

export type WeightTier = {
  maxWeightKg: number
  priceWithVat: number
}

export type ShippingPricingInput = {
  usesWeightTiers: boolean
  /** Paušál pro metody bez pásem */
  priceWithVat: number
  /** Pásma seřazená vzestupně dle maxWeightKg (funkce si je seřadí sama) */
  weightTiers: WeightTier[]
  fuelSurchargePercent: number
  freeShippingThreshold: number | null
}

export type ShippingPriceResult = {
  /** Výsledná cena s DPH (0 = doprava zdarma). null = metoda pro tuto váhu nemá pásmo. */
  priceWithVat: number | null
  /** Použité pásmo („do X kg") — jen u ceníku podle váhy */
  tier: WeightTier | null
  /** Cena pásma před příplatkem a dopravou zdarma */
  basePriceWithVat: number
  /** Palivový příplatek v Kč (zaokrouhlený na koruny) */
  surchargeWithVat: number
  /** Doprava zdarma díky freeShippingThreshold */
  isFree: boolean
  /** Kolik chybí do dopravy zdarma (0 = už je zdarma nebo limit není) */
  amountToFreeShipping: number
}

/**
 * Cena dopravy pro daný košík. Pořadí výpočtu:
 * pásmo dle váhy → + palivový příplatek % (zaokrouhlený na koruny)
 * → doprava zdarma (subtotal >= threshold → 0 Kč).
 */
export function resolveShippingPrice(
  method: ShippingPricingInput,
  cartWeightKg: number,
  subtotalWithVat: number,
): ShippingPriceResult {
  const threshold = method.freeShippingThreshold
  const isFree = !!(threshold && subtotalWithVat >= threshold)
  const amountToFreeShipping = threshold && !isFree ? Math.max(0, threshold - subtotalWithVat) : 0

  let basePriceWithVat: number
  let tier: WeightTier | null = null

  if (method.usesWeightTiers) {
    const sorted = [...method.weightTiers].sort((a, b) => a.maxWeightKg - b.maxWeightKg)
    tier = sorted.find((t) => t.maxWeightKg >= cartWeightKg) ?? null
    if (!tier) {
      // váha nad nejvyšší pásmo — metoda není dostupná
      return {
        priceWithVat: null, tier: null, basePriceWithVat: 0,
        surchargeWithVat: 0, isFree: false, amountToFreeShipping,
      }
    }
    basePriceWithVat = tier.priceWithVat
  } else {
    basePriceWithVat = method.priceWithVat
  }

  const surchargeWithVat =
    method.fuelSurchargePercent > 0
      ? Math.round(basePriceWithVat * (method.fuelSurchargePercent / 100))
      : 0

  return {
    priceWithVat: isFree ? 0 : basePriceWithVat + surchargeWithVat,
    tier,
    basePriceWithVat,
    surchargeWithVat,
    isFree,
    amountToFreeShipping,
  }
}
