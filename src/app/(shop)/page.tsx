import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CarouselClient, type CarouselSlide } from './_components/CarouselClient'
import { ProductCard, type ProductCardData } from './_components/ProductCard'
import { HorizontalShelf } from './_components/HorizontalShelf'

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
  isWeightBased: boolean; unit: string; weightGrams: number | null
  isNew: boolean; isOnSale: boolean; isFeatured: boolean
  stockQuantity: number; stockStatus: string; trackStock: boolean
  images: Array<{ thumbnailUrl: string; url: string }>
}): ProductCardData {
  return {
    id: p.id, slug: p.slug, sku: p.sku, name: p.name,
    priceWithVat: Number(p.priceWithVat),
    priceWithoutVat: Number(p.priceWithoutVat),
    vatRate: Number(p.vatRate),
    isWeightBased: p.isWeightBased,
    unit: p.unit, weightGrams: p.weightGrams,
    isNew: p.isNew, isOnSale: p.isOnSale, isFeatured: p.isFeatured,
    stockQuantity: p.stockQuantity,
    stockStatus: p.stockStatus,
    trackStock: p.trackStock,
    thumbnailUrl: p.images[0]?.thumbnailUrl || p.images[0]?.url || null,
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
  isWeightBased: true, unit: true, weightGrams: true,
  isNew: true, isOnSale: true, isFeatured: true,
  stockQuantity: true, stockStatus: true, trackStock: true,
  images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true }, take: 1 },
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
        {title && <h2 className="mb-4 text-2xl font-bold text-white">{title}</h2>}
        <p className="leading-relaxed text-stone-300">{text}</p>
      </div>
    </section>
  )
}

// ── Carousel sekce ────────────────────────────────────────────────

async function CarouselSection({ title }: { title: string | null }) {
  const banners = await prisma.banner.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: 'asc' },
    include: { page: { select: { slug: true } } },
  })

  if (!banners.length) return null

  const slides: CarouselSlide[] = banners.map((b) => {
    let href: string | null = null
    if (b.linkType === 'PAGE' && b.page?.slug) href = `/${b.page.slug}`
    else if (b.linkType === 'CATEGORY' && b.categoryId) href = `/kategorie/${b.categoryId}`
    else if (b.linkType === 'URL' && b.url) href = b.url
    return { id: b.id, imageUrl: b.imageUrl, imageAlt: b.imageAlt, href, openNewTab: b.openNewTab }
  })

  return (
    <section>
      {title && (
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
        </div>
      )}
      <CarouselClient slides={slides} />
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

        return null
      })}
    </>
  )
}
