import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard, type ProductCardData } from '../../_components/ProductCard'
import { CategorySidebar } from './_components/CategorySidebar'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sub?: string }>
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
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, slug: true, _count: { select: { products: true } } } },
    },
  })
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
      isWeightBased: true, unit: true, weightGrams: true,
      isNew: true, isOnSale: true, isFeatured: true,
      stockQuantity: true, stockStatus: true, trackStock: true,
      images: { where: { isPrimary: true }, select: { thumbnailUrl: true, url: true }, take: 1 },
    },
  })

  const cards: ProductCardData[] = products.map((p) => ({
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
  }))

  // Podkategorie s počtem produktů v daném filtru (zobraz jen ty s produkty)
  const subcatsWithProducts = category.children.filter(
    (c) => c._count.products > 0 || descendantIds.includes(c.id)
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
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
        <h1 className="text-3xl font-bold text-white">
          {activeSub ? activeSub.name : category.name}
        </h1>
        <span className="text-sm text-shop-muted">{cards.length} produktů</span>
      </div>

      {/* Mobile filtr — details/summary (CSS only, bez JS) */}
      {subcatsWithProducts.length > 0 && (
        <details className="mb-5 md:hidden">
          <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-shop-border bg-shop-surface px-4 py-3 text-sm font-medium text-stone-200 list-none">
            <span>Filtrovat dle podkategorie</span>
            <span className="text-shop-muted">▼</span>
          </summary>
          <div className="mt-2 rounded-xl border border-shop-border bg-shop-surface p-3">
            <nav className="flex flex-col gap-1">
              <Link href={`/kategorie/${slug}`}
                className={`rounded-lg px-3 py-2 text-sm transition ${!activeSub ? 'bg-gold/10 font-semibold text-gold' : 'text-stone-300 hover:text-gold'}`}>
                Vše z {category.name}
              </Link>
              {subcatsWithProducts.map((c) => (
                <Link key={c.id} href={`/kategorie/${slug}?sub=${c.slug}`}
                  className={`rounded-lg px-3 py-2 text-sm transition ${activeSub?.slug === c.slug ? 'bg-gold/10 font-semibold text-gold' : 'text-stone-300 hover:text-gold'}`}>
                  {c.name}
                  {c._count.products > 0 && <span className="ml-1.5 text-xs text-shop-muted">({c._count.products})</span>}
                </Link>
              ))}
            </nav>
          </div>
        </details>
      )}

      {/* Dvousloupcový layout */}
      <div className="flex gap-8">
        {/* Sidebar — desktop */}
        {subcatsWithProducts.length > 0 && (
          <aside className="hidden md:block w-52 shrink-0">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-shop-muted">
              Podkategorie
            </p>
            <CategorySidebar
              categorySlug={slug}
              subcategories={subcatsWithProducts.map((c) => ({
                id: c.id, name: c.name, slug: c.slug, count: c._count.products,
              }))}
              activeSub={activeSub?.slug ?? null}
              totalLabel={`Vše z ${category.name}`}
            />
          </aside>
        )}

        {/* Mřížka produktů */}
        <div className="min-w-0 flex-1">
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
      </div>
    </div>
  )
}

