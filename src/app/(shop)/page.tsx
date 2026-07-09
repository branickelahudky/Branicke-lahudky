import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { activeSaleWhere } from '@/lib/pricing'
import { CarouselClient, type CarouselSlide } from './_components/CarouselClient'
import { ProductCard, type ProductCardData } from './_components/ProductCard'
import { HorizontalShelf } from './_components/HorizontalShelf'
import { JsonLd } from './_components/JsonLd'
import { localBusinessJsonLd } from '@/lib/structured-data'

// ── Sdílené řešení odkazu banneru dle linkType ────────────────────

type BannerLinkSource = {
  linkType: string
  page: { slug: string } | null
  category: { slug: string } | null
  url: string | null
}

function resolveBannerHref(b: BannerLinkSource): string | null {
  if (b.linkType === 'PAGE' && b.page?.slug) return `/${b.page.slug}`
  if (b.linkType === 'CATEGORY' && b.category?.slug) return `/kategorie/${b.category.slug}`
  if (b.linkType === 'URL' && b.url) return b.url
  return null
}

const BANNER_LINK_INCLUDE = {
  page: { select: { slug: true } },
  category: { select: { slug: true } },
} as const

// ── Pomocná funkce pro produktová data ────────────────────────────

function serializeProduct(p: {
  id: string; slug: string; sku: string; name: string
  priceWithVat: unknown; priceWithoutVat: unknown; vatRate: unknown
  salePriceWithVat: unknown
  saleStartsAt: Date | null; saleEndsAt: Date | null
  isWeightBased: boolean; unit: string; weightGrams: number | null
  isNew: boolean; isOnSale: boolean; isFeatured: boolean
  stockQuantity: number; stockStatus: string; trackStock: boolean
  images: Array<{ thumbnailUrl: string; url: string; fileSize: number }>
  _count: { variants: number }
}): ProductCardData {
  return {
    id: p.id, slug: p.slug, sku: p.sku, name: p.name,
    priceWithVat:    Number(p.priceWithVat),
    priceWithoutVat: Number(p.priceWithoutVat),
    vatRate:         Number(p.vatRate),
    salePriceWithVat: p.salePriceWithVat ? Number(p.salePriceWithVat) : null,
    saleStartsAt: p.saleStartsAt?.toISOString() ?? null,
    saleEndsAt: p.saleEndsAt?.toISOString() ?? null,
    isWeightBased: p.isWeightBased,
    unit: p.unit, weightGrams: p.weightGrams,
    isNew: p.isNew, isOnSale: p.isOnSale, isFeatured: p.isFeatured,
    stockQuantity: p.stockQuantity,
    stockStatus:   p.stockStatus,
    trackStock:    p.trackStock,
    hasVariants:   p._count.variants > 0,
    thumbnailUrl: (() => {
      const img = p.images[0]
      if (!img) return null
      const base = img.thumbnailUrl || img.url
      return img.fileSize > 0 ? `${base}?v=${img.fileSize}` : base
    })(),
  }
}

// ── Sekce kategorií — horizontální regál dlaždic ──────────────────

async function FeaturedCategoriesSection({ title, categoryIds }: { title: string | null; categoryIds: string[] }) {
  const cats = await prisma.category.findMany({
    where: { id: { in: categoryIds }, isActive: true },
    select: { id: true, name: true, slug: true },
  })
  const ordered = categoryIds.map((id) => cats.find((c) => c.id === id)).filter(Boolean) as typeof cats

  if (!ordered.length) return null

  return (
    <HorizontalShelf title={title}>
      {ordered.map((cat) => (
        <Link
          key={cat.id}
          href={`/kategorie/${cat.slug}`}
          className="
            group flex shrink-0 snap-start
            w-[47vw] sm:w-44
            items-center justify-center rounded-xl
            border border-shop-border bg-shop-surface
            p-6 text-center
            transition hover:border-gold/40 hover:bg-shop-card
          "
        >
          <span className="text-sm font-semibold text-stone-200 group-hover:text-gold transition">
            {cat.name}
          </span>
        </Link>
      ))}
    </HorizontalShelf>
  )
}

// ── Produktové regály dle příznaku (Akce / Novinky / Doporučujeme) ─
//    Každý je samostatná sekce; řazení dle updatedAt desc, prázdný se skryje.

const FLAG_SELECT = {
  id: true, slug: true, sku: true, name: true,
  priceWithVat: true, priceWithoutVat: true, vatRate: true,
  salePriceWithVat: true, saleStartsAt: true, saleEndsAt: true,
  isWeightBased: true, unit: true, weightGrams: true,
  isNew: true, isOnSale: true, isFeatured: true,
  stockQuantity: true, stockStatus: true, trackStock: true,
  images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true, fileSize: true }, take: 1 },
  _count: { select: { variants: { where: { isActive: true } } } },
} as const

type ShelfKind = 'SHELF_SALE' | 'SHELF_NEW' | 'SHELF_FEATURED'

// Regál Akce filtruje jen AKTIVNÍ slevy — where se skládá až v době
// dotazu (activeSaleWhere pracuje s aktuálním časem)
const SHELF_DEFS: Record<ShelfKind, { defaultTitle: string; where: () => Record<string, unknown>; limit: number; moreHref: string }> = {
  SHELF_SALE:     { defaultTitle: 'Akce',        where: () => activeSaleWhere(), limit: 60, moreHref: '/akce' },
  SHELF_NEW:      { defaultTitle: 'Novinky',     where: () => ({ isNew: true }),      limit: 6,  moreHref: '/novinky' },
  SHELF_FEATURED: { defaultTitle: 'Doporučujeme', where: () => ({ isFeatured: true }), limit: 18, moreHref: '/doporucujeme' },
}

async function ShelfSection({ kind, title }: { kind: ShelfKind; title: string | null }) {
  const def = SHELF_DEFS[kind]
  const products = await prisma.product.findMany({
    where: { isActive: true, ...def.where() },
    orderBy: { updatedAt: 'desc' },
    select: FLAG_SELECT,
    take: def.limit,
  })
  if (!products.length) return null
  return (
    <HorizontalShelf title={title?.trim() || def.defaultTitle} moreHref={def.moreHref}>
      {products.map(serializeProduct).map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </HorizontalShelf>
  )
}

// ── Sekce O nás ───────────────────────────────────────────────────

function AboutTextSection({ title, text }: { title: string | null; text: string }) {
  if (!text.trim()) return null

  return (
    <section className="py-10 border-t border-shop-border">
      <div className="mx-auto max-w-3xl px-4 text-center">
        {title && <h2 className="mb-4 text-2xl font-bold text-shop-fg">{title}</h2>}
        <p className="leading-relaxed text-stone-300">{text}</p>
      </div>
    </section>
  )
}

// ── Carousel sekce ────────────────────────────────────────────────

async function CarouselSection({ title }: { title: string | null }) {
  const banners = await prisma.banner.findMany({
    where: { isVisible: true, placement: 'CAROUSEL' },
    orderBy: { sortOrder: 'asc' },
    include: BANNER_LINK_INCLUDE,
  })

  if (!banners.length) return null

  const slides: CarouselSlide[] = banners.map((b) => ({
    id: b.id, imageUrl: b.imageUrl, imageAlt: b.imageAlt,
    href: resolveBannerHref(b), openNewTab: b.openNewTab,
  }))

  return (
    <section>
      {title && (
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-4">
          <h2 className="text-xl font-bold text-shop-fg">{title}</h2>
        </div>
      )}
      <CarouselClient slides={slides} />
    </section>
  )
}

// ── A) Promo dlaždice (placement = PROMO_TILE) ────────────────────

async function PromoTilesSection() {
  const banners = await prisma.banner.findMany({
    where: { isVisible: true, placement: 'PROMO_TILE' },
    orderBy: { sortOrder: 'asc' },
    include: BANNER_LINK_INCLUDE,
  })
  if (!banners.length) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {banners.map((b) => {
          const href = resolveBannerHref(b)
          const inner = (
            <div className="group relative aspect-[3/2] overflow-hidden rounded-2xl bg-shop-card">
              <Image src={b.imageUrl} alt={b.imageAlt ?? b.title ?? ''} fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, 20vw" unoptimized />
              {(b.title || b.subtitle) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                  {b.title && <p className="text-sm font-bold leading-tight text-white">{b.title}</p>}
                  {b.subtitle && <p className="mt-0.5 text-xs text-white/85">{b.subtitle}</p>}
                </div>
              )}
            </div>
          )
          return href ? (
            <Link key={b.id} href={href} target={b.openNewTab ? '_blank' : undefined}>{inner}</Link>
          ) : (
            <div key={b.id}>{inner}</div>
          )
        })}
      </div>
    </section>
  )
}

// ── B) Široký banner mezi regály (placement = MID_WIDE) ───────────

async function MidBannerSection() {
  const b = await prisma.banner.findFirst({
    where: { isVisible: true, placement: 'MID_WIDE' },
    orderBy: { sortOrder: 'asc' },
    include: BANNER_LINK_INCLUDE,
  })
  if (!b) return null

  const href = resolveBannerHref(b)
  const inner = (
    <div className="group relative aspect-[4/1] overflow-hidden rounded-2xl bg-shop-card">
      <Image src={b.imageUrl} alt={b.imageAlt ?? b.title ?? ''} fill
        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        sizes="(max-width: 1280px) 100vw, 1280px" unoptimized />
      {(b.title || b.subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/65 via-black/25 to-transparent p-6 sm:p-10">
          {b.title && <p className="text-lg font-bold text-white sm:text-2xl">{b.title}</p>}
          {b.subtitle && <p className="mt-1 text-sm text-white/85 sm:text-base">{b.subtitle}</p>}
        </div>
      )}
    </div>
  )

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      {href ? (
        <Link href={href} target={b.openNewTab ? '_blank' : undefined}>{inner}</Link>
      ) : inner}
    </section>
  )
}

// ── C) Trojice karet nad patičkou (placement = FOOTER_CARD) ───────

async function FooterCardsSection() {
  const banners = await prisma.banner.findMany({
    where: { isVisible: true, placement: 'FOOTER_CARD' },
    orderBy: { sortOrder: 'asc' },
    take: 3,
    include: BANNER_LINK_INCLUDE,
  })
  if (!banners.length) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {banners.map((b) => {
          const href = resolveBannerHref(b)
          const inner = (
            <div className="group">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-shop-card">
                <Image src={b.imageUrl} alt={b.imageAlt ?? b.title ?? ''} fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw" unoptimized />
              </div>
              {(b.title || b.subtitle) && (
                <div className="pt-3">
                  {b.title && <p className="text-base font-bold text-shop-fg transition group-hover:text-gold">{b.title}</p>}
                  {b.subtitle && <p className="mt-0.5 text-sm text-shop-muted">{b.subtitle}</p>}
                </div>
              )}
            </div>
          )
          return href ? (
            <Link key={b.id} href={href} target={b.openNewTab ? '_blank' : undefined}>{inner}</Link>
          ) : (
            <div key={b.id}>{inner}</div>
          )
        })}
      </div>
    </section>
  )
}

// ── Homepage ──────────────────────────────────────────────────────

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ kosik?: string }>
}) {
  const { kosik } = await searchParams
  const [sections, branch] = await Promise.all([
    prisma.homepageSection.findMany({
      where: { isVisible: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.branchSettings.findFirst(),
  ])

  return (
    <>
      {branch && <JsonLd data={localBusinessJsonLd(branch)} />}
      {kosik === 'prazdny' && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-shop-fg">
            Váš košík je prázdný — do pokladny můžete pokračovat, jakmile si vyberete zboží.
          </div>
        </div>
      )}
      {sections.map((section) => {
        const cfg = (section.config ?? {}) as Record<string, unknown>

        if (section.type === 'CAROUSEL') {
          return <CarouselSection key={section.id} title={section.title} />
        }

        if (section.type === 'PROMO_TILES') {
          return <PromoTilesSection key={section.id} />
        }

        if (section.type === 'FEATURED_CATEGORIES') {
          const ids = (cfg.categoryIds as string[]) ?? []
          if (!ids.length) return null
          return <FeaturedCategoriesSection key={section.id} title={section.title} categoryIds={ids} />
        }

        if (section.type === 'SHELF_SALE') {
          return <ShelfSection key={section.id} kind="SHELF_SALE" title={section.title} />
        }

        if (section.type === 'SHELF_NEW') {
          return <ShelfSection key={section.id} kind="SHELF_NEW" title={section.title} />
        }

        if (section.type === 'MID_BANNER') {
          return <MidBannerSection key={section.id} />
        }

        if (section.type === 'SHELF_FEATURED') {
          return <ShelfSection key={section.id} kind="SHELF_FEATURED" title={section.title} />
        }

        if (section.type === 'ABOUT_TEXT') {
          const text = (cfg.text as string) ?? ''
          return <AboutTextSection key={section.id} title={section.title} text={text} />
        }

        if (section.type === 'FOOTER_CARDS') {
          return <FooterCardsSection key={section.id} />
        }

        return null
      })}
    </>
  )
}
