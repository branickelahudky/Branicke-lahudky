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
