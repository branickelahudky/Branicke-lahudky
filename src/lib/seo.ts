import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// ── Základní URL webu ─────────────────────────────────────────────

export const SITE_URL = (process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

// ── Fallbacky (shodné s původními hardcoded hodnotami z F24) ─────

export const FALLBACK_SITE_TITLE = 'Branické lahůdkářství — čerstvé maso, ryby a lahůdky'
export const FALLBACK_TITLE_TEMPLATE = '%s | Branické lahůdkářství'
export const FALLBACK_DESCRIPTION =
  'Rodinné řeznictví a lahůdkářství v Praze 4 od roku 1991. Čerstvé maso, ryby, uzeniny a poctivé lahůdky s rozvozem po ČR i Slovensku.'
export const SITE_NAME = 'Branické lahůdkářství'

// ── Globální SEO nastavení z adminu (Vzhled → SEO) ────────────────

// cache() = jeden dotaz na request i když metadata čte víc míst
export const getSeoSettings = cache(async () => {
  return prisma.seoSettings.findFirst().catch(() => null)
})

// ── Automatika meta popisů ────────────────────────────────────────

/** Odstraní HTML značky a entity, srazí bílé znaky. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Vytáhne z textu úvod pro meta description: první věta/y do ~160 znaků.
 * Vrací null, když není z čeho brát.
 */
export function excerptForMeta(raw: string | null | undefined, maxLen = 160): string | null {
  if (!raw) return null
  const text = stripHtml(raw)
  if (!text) return null
  if (text.length <= maxLen) return text

  // Zkus useknout na konci věty
  const slice = text.slice(0, maxLen)
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
  if (sentenceEnd > maxLen * 0.4) return slice.slice(0, sentenceEnd + 1)

  // Jinak na hranici slova s výpustkou
  const wordEnd = slice.lastIndexOf(' ')
  return (wordEnd > 0 ? slice.slice(0, wordEnd) : slice) + '…'
}

/** Titulek produktu: vlastní metaTitle, jinak „{name} — {kategorie}" (šablona doplní web). */
export function productAutoTitle(p: { name: string; metaTitle?: string | null }, categoryName?: string | null): string {
  if (p.metaTitle?.trim()) return p.metaTitle.trim()
  return categoryName ? `${p.name} — ${categoryName}` : p.name
}

/** Description produktu: vlastní metaDescription, jinak krátký popis / první věta popisu. */
export function productAutoDescription(p: {
  metaDescription?: string | null
  shortDescription?: string | null
  description?: string | null
}): string | null {
  if (p.metaDescription?.trim()) return p.metaDescription.trim()
  return excerptForMeta(p.shortDescription) ?? excerptForMeta(p.description)
}

/** Titulek kategorie: vlastní metaTitle, jinak název (šablona doplní web). */
export function categoryAutoTitle(c: { name: string; metaTitle?: string | null }): string {
  return c.metaTitle?.trim() || c.name
}

/** Description kategorie: vlastní metaDescription, jinak z popisu, jinak generická věta. */
export function categoryAutoDescription(c: {
  name: string
  metaDescription?: string | null
  description?: string | null
}): string {
  if (c.metaDescription?.trim()) return c.metaDescription.trim()
  return (
    excerptForMeta(c.description) ??
    `${c.name} z nabídky Branického lahůdkářství — rodinného řeznictví a lahůdkářství v Praze 4.`
  )
}
