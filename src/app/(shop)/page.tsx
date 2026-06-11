import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { CarouselClient, type CarouselSlide } from './_components/CarouselClient'
import { ProductCard, type ProductCardData } from './_components/ProductCard'
import { HorizontalShelf } from './_components/HorizontalShelf'

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

// ── Dlaždice top-level kategorií ──────────────────────────────────

async function CategoryTiles() {
  const categories = await prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, slug: true },
  })

  if (!categories.length) return null

  return (
    <div className="border-b border-shop-border">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex gap-2 overflow-x-auto py-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/kategorie/${cat.slug}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-shop-border bg-shop-surface px-4 py-2 text-sm text-stone-300 whitespace-nowrap hover:border-gold/50 hover:text-gold transition">
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Pomocná funkce pro produktová data ────────────────────────────

function serializeProduct(p: {
  id: string; slug: string; sku: string; name: string
  priceWithVat: unknown; priceWithoutVat: unknown; vatRate: unknown
  salePriceWithVat: unknown
  isWeightBased: boolean; unit: string; weightGrams: number | null
  isNew: boolean; isOnSale: boolean; isFeatured: boolean
  stockQuantity: number; stockStatus: string; trackStock: boolean
  images: Array<{ thumbnailUrl: string; url: string; fileSize: number }>
}): ProductCardData {
  return {
    id: p.id, slug: p.slug, sku: p.sku, name: p.name,
    priceWithVat:    Number(p.priceWithVat),
    priceWithoutVat: Number(p.priceWithoutVat),
    vatRate:         Number(p.vatRate),
    salePriceWithVat: p.salePriceWithVat ? Number(p.salePriceWithVat) : null,
    isWeightBased: p.isWeightBased,
    unit: p.unit, weightGrams: p.weightGrams,
    isNew: p.isNew, isOnSale: p.isOnSale, isFeatured: p.isFeatured,
    stockQuantity: p.stockQuantity,
    stockStatus:   p.stockStatus,
    trackStock:    p.trackStock,
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

// ── Pevné regály dle příznaku (řazeno dle updatedAt — viz dohoda,
//    později možno nahradit dedikovaným polem data zařazení do regálu) ─

const FLAG_SELECT = {
  id: true, slug: true, sku: true, name: true,
  priceWithVat: true, priceWithoutVat: true, vatRate: true,
  salePriceWithVat: true,
  isWeightBased: true, unit: true, weightGrams: true,
  isNew: true, isOnSale: true, isFeatured: true,
  stockQuantity: true, stockStatus: true, trackStock: true,
  images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true, fileSize: true }, take: 1 },
} as const

async function AkceSection() {
  const products = await prisma.product.findMany({
    where: { isActive: true, isOnSale: true },
    orderBy: { updatedAt: 'desc' },
    select: FLAG_SELECT,
    take: 12,
  })
  if (!products.length) return null
  return (
    <HorizontalShelf title="Akce" moreHref="#">
      {products.map(serializeProduct).map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </HorizontalShelf>
  )
}

async function NovinkySekce() {
  const products = await prisma.product.findMany({
    where: { isActive: true, isNew: true },
    orderBy: { updatedAt: 'desc' },
    select: FLAG_SELECT,
    take: 12,
  })
  if (!products.length) return null
  return (
    <HorizontalShelf title="Novinky" moreHref="#">
      {products.map(serializeProduct).map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </HorizontalShelf>
  )
}

// ── Sekce produktů — horizontální regál karet ─────────────────────

async function FeaturedProductsSection({ title, mode, productIds, limit }: {
  title: string | null
  mode: string
  productIds: string[]
  limit: number
}) {
  const select = FLAG_SELECT

  const products = mode === 'manual' && productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select,
        take: limit,
      })
    : await prisma.product.findMany({
        where: { isFeatured: true, isActive: true, publishedAt: { lte: new Date() } },
        orderBy: { name: 'asc' },
        select,
        take: limit,
      })

  if (!products.length) return null

  const cards = products.map(serializeProduct)

  return (
    <HorizontalShelf title={title}>
      {cards.map((p) => (
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

export default async function HomePage() {
  const sections = await prisma.homepageSection.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <>
      <CategoryTiles />
      <AkceSection />
      <NovinkySekce />

      {sections.map((section) => {
        const cfg = (section.config ?? {}) as Record<string, unknown>

        if (section.type === 'CAROUSEL') {
          return <CarouselSection key={section.id} title={section.title} />
        }

        if (section.type === 'FEATURED_CATEGORIES') {
          const ids = (cfg.categoryIds as string[]) ?? []
          if (!ids.length) return null
          return <FeaturedCategoriesSection key={section.id} title={section.title} categoryIds={ids} />
        }

        if (section.type === 'FEATURED_PRODUCTS') {
          const mode = (cfg.mode as string) ?? 'featured'
          const ids = (cfg.productIds as string[]) ?? []
          const limit = Number(cfg.limit ?? 8)
          return <FeaturedProductsSection key={section.id} title={section.title} mode={mode} productIds={ids} limit={limit} />
        }

        if (section.type === 'ABOUT_TEXT') {
          const text = (cfg.text as string) ?? ''
          return <AboutTextSection key={section.id} title={section.title} text={text} />
        }

        if (section.type === 'PROMO_TILES') {
          return <PromoTilesSection key={section.id} />
        }

        if (section.type === 'MID_BANNER') {
          return <MidBannerSection key={section.id} />
        }

        if (section.type === 'FOOTER_CARDS') {
          return <FooterCardsSection key={section.id} />
        }

        return null
      })}
    </>
  )
}
