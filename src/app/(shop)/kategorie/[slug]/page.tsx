import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { ProductCard, type ProductCardData } from '../../_components/ProductCard'
import { JsonLd } from '../../_components/JsonLd'
import { categoryAutoTitle, categoryAutoDescription } from '@/lib/seo'
import { breadcrumbJsonLd } from '@/lib/structured-data'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sub?: string }>
}

// cache() = generateMetadata a page sdílí jeden dotaz na request
const getCategory = cache(async (slug: string) => {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, slug: true, imageUrl: true, _count: { select: { products: true } } } },
    },
  })
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategory(slug)
  if (!category) return {}

  const title = categoryAutoTitle(category)
  const description = categoryAutoDescription(category)

  return {
    title,
    description,
    // Varianty ?sub=... jsou jen filtr — kanonická je stránka kategorie
    alternates: { canonical: `/kategorie/${category.slug}` },
    openGraph: {
      title,
      description,
      url: `/kategorie/${category.slug}`,
      ...(category.imageUrl ? { images: [{ url: category.imageUrl }] } : {}),
    },
  }
}

// ── Rekurzivní sběr ID podkategorií ───────────────────────────────

async function collectDescendantIds(categoryId: string): Promise<string[]> {
  const children = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  })
  if (!children.length) return []
  const ids = children.map((c) => c.id)
  const nested = await Promise.all(ids.map(collectDescendantIds))
  return [...ids, ...nested.flat()]
}

// ── Page ───────────────────────────────────────────────────────────

export default async function KategoriePage({ params, searchParams }: Props) {
  const { slug } = await params
  const { sub } = await searchParams

  // Načti kategorii
  const category = await getCategory(slug)
  if (!category) notFound()

  // Všechny descendant IDs pro rekurzivní načtení produktů
  const descendantIds = await collectDescendantIds(category.id)
  const allCategoryIds = [category.id, ...descendantIds]

  // Aktivní filtr na podkategorii
  const activeSub = sub
    ? category.children.find((c) => c.slug === sub) ?? null
    : null
  const filterIds = activeSub ? [activeSub.id, ...(await collectDescendantIds(activeSub.id))] : allCategoryIds

  // Produkty
  const products = await prisma.product.findMany({
    where: { categoryId: { in: filterIds }, isActive: true },
    orderBy: { name: 'asc' },
    take: 48,
    select: {
      id: true, slug: true, sku: true, name: true,
      priceWithVat: true, priceWithoutVat: true, vatRate: true,
      salePriceWithVat: true, saleStartsAt: true, saleEndsAt: true,
      isWeightBased: true, unit: true, weightGrams: true,
      isNew: true, isOnSale: true, isFeatured: true,
      stockQuantity: true, stockStatus: true, trackStock: true,
      images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true, fileSize: true }, take: 1 },
            _count: { select: { variants: { where: { isActive: true } } } },
    },
  })

  const cards: ProductCardData[] = products.map((p) => ({
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
  }))

  // Podkategorie s počtem produktů v daném filtru (zobraz jen ty s produkty)
  const subcatsWithProducts = category.children.filter(
    (c) => c._count.products > 0 || descendantIds.includes(c.id)
  )

  const breadcrumbs = [
    { name: 'Domů', path: '/' },
    ...(category.parent ? [{ name: category.parent.name, path: `/kategorie/${category.parent.slug}` }] : []),
    { name: category.name, path: `/kategorie/${category.slug}` },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-shop-muted">
        <Link href="/" className="hover:text-gold transition">Domů</Link>
        {category.parent && (
          <>
            <span>/</span>
            <Link href={`/kategorie/${category.parent.slug}`}
              className="hover:text-gold transition">{category.parent.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="text-stone-300">{category.name}</span>
        {activeSub && (
          <>
            <span>/</span>
            <span className="text-stone-300">{activeSub.name}</span>
          </>
        )}
      </nav>

      {/* Nadpis */}
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="text-3xl font-extrabold text-shop-fg">
          {activeSub ? activeSub.name : category.name}
        </h1>
        <span className="text-sm text-shop-muted">{cards.length} produktů</span>
      </div>

      {/* Dlaždice podkategorií (jako starý web) — nahrazují boční strom */}
      {subcatsWithProducts.length > 0 && (
        <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <Link
            href={`/kategorie/${slug}`}
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium transition ${
              !activeSub
                ? 'border-gold bg-gold/5 text-gold ring-1 ring-gold'
                : 'border-stone-200 bg-white text-shop-fg hover:border-gold hover:text-gold'
            }`}
          >
            <span className="truncate">Vše z {category.name}</span>
          </Link>
          {subcatsWithProducts.map((c) => {
            const isActive = activeSub?.slug === c.slug
            return (
              <Link
                key={c.id}
                href={`/kategorie/${slug}?sub=${c.slug}`}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'border-gold bg-gold/5 text-gold ring-1 ring-gold'
                    : 'border-stone-200 bg-white text-shop-fg hover:border-gold hover:text-gold'
                }`}
              >
                {c.imageUrl && (
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    <Image src={c.imageUrl} alt="" fill className="object-cover" sizes="32px" unoptimized />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate">{c.name}</span>
                  {c._count.products > 0 && (
                    <span className="block text-xs font-normal text-shop-muted">
                      {c._count.products} produktů
                    </span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Mřížka produktů */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-shop-border py-20 text-center">
          <p className="text-lg font-semibold text-stone-400">Zatím žádné produkty</p>
          <p className="mt-2 text-sm text-shop-muted">
            V této kategorii momentálně nic není.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {cards.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {products.length === 48 && (
            <p className="mt-6 text-center text-sm text-shop-muted">
              Zobrazeno prvních 48 produktů — stránkování připravujeme.
            </p>
          )}
        </>
      )}
    </div>
  )
}

