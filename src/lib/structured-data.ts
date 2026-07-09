import { SITE_URL, SITE_NAME, stripHtml } from '@/lib/seo'

// Schema.org JSON-LD buildery. Vrací plain objekty — do stránky je vkládá
// komponenta <JsonLd data={...} />.

// ── Product ───────────────────────────────────────────────────────

type ProductForJsonLd = {
  name: string
  slug: string
  sku: string
  shortDescription?: string | null
  description?: string | null
  brandName?: string | null
  priceWithVat: number
  salePriceWithVat?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  stockStatus: string
  images: Array<{ url: string }>
}

function isSaleActive(p: ProductForJsonLd): boolean {
  if (p.salePriceWithVat == null) return false
  const now = Date.now()
  if (p.saleStartsAt && now < new Date(p.saleStartsAt).getTime()) return false
  if (p.saleEndsAt && now > new Date(p.saleEndsAt).getTime()) return false
  return true
}

export function productJsonLd(p: ProductForJsonLd) {
  const description = p.shortDescription
    ? stripHtml(p.shortDescription)
    : p.description
      ? stripHtml(p.description).slice(0, 300)
      : undefined

  const price = isSaleActive(p) ? p.salePriceWithVat! : p.priceWithVat
  const inStock = p.stockStatus === 'IN_STOCK' || p.stockStatus === 'LOW_STOCK'

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(description ? { description } : {}),
    sku: p.sku,
    ...(p.images.length ? { image: p.images.map((i) => i.url) } : {}),
    brand: { '@type': 'Brand', name: p.brandName?.trim() || SITE_NAME },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/produkt/${p.slug}`,
      price: price.toFixed(2),
      priceCurrency: 'CZK',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }
}

// ── BreadcrumbList ────────────────────────────────────────────────

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}

// ── LocalBusiness (Butcher) ───────────────────────────────────────

type BranchForJsonLd = {
  name: string
  street: string
  zip: string
  city: string
  email?: string | null
  phone1?: string | null
  openingHours?: string | null
}

/**
 * Převod českého textu otevírací doby („Po 10:00 - 17:30" po řádcích)
 * na schema.org formát („Mo 10:00-17:30"). Neparsovatelné řádky a
 * „zavřeno" se vynechají.
 */
export function parseOpeningHours(text: string | null | undefined): string[] {
  if (!text) return []
  const DAY: Record<string, string> = {
    po: 'Mo', út: 'Tu', ut: 'Tu', st: 'We', čt: 'Th', ct: 'Th',
    pá: 'Fr', pa: 'Fr', so: 'Sa', ne: 'Su',
  }
  const out: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || /zavřeno/i.test(trimmed)) continue
    const m = trimmed.match(/^([^\s]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
    if (!m) continue
    const days = m[1]
      .split('-')
      .map((d) => DAY[d.toLowerCase().replace(/[.,]/g, '')])
    if (days.some((d) => !d)) continue
    out.push(`${days.join('-')} ${m[2]}-${m[3]}`)
  }
  return out
}

export function localBusinessJsonLd(branch: BranchForJsonLd) {
  const openingHours = parseOpeningHours(branch.openingHours)
  return {
    '@context': 'https://schema.org',
    '@type': 'Butcher',
    name: branch.name,
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: branch.street,
      postalCode: branch.zip,
      addressLocality: branch.city,
      addressCountry: 'CZ',
    },
    ...(branch.phone1 ? { telephone: `+420${branch.phone1.replace(/\s/g, '')}` } : {}),
    ...(branch.email ? { email: branch.email } : {}),
    ...(openingHours.length ? { openingHours } : {}),
    priceRange: '$$',
  }
}
