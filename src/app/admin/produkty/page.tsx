import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { AdminSidebar } from '@/app/admin/_components/AdminSidebar'
import { AdminHeader } from '@/app/admin/_components/AdminHeader'
import {
  ProductsClient,
  type SerializedProduct,
  type SerializedCategory,
} from './ProductsClient'

const PAGE_SIZE = 50

interface Props {
  searchParams: Promise<{
    kategorie?: string
    hledat?: string
    strana?: string
    sort?: string
    order?: string
    hmotnost?: string
  }>
}

// Produkt „bez hmotnosti" = doprava se u něj počítá jen z výchozího odhadu:
// není váhový, nemá vyplněnou váhu produktu a (nemá varianty NEBO aspoň
// jedné aktivní variantě váha chybí — produktová váha by ji jinak pokryla).
const MISSING_WEIGHT_WHERE: Prisma.ProductWhereInput = {
  isWeightBased: false,
  weightGrams: null,
  approximateWeightKg: null,
  OR: [
    { variants: { none: { isActive: true } } },
    { variants: { some: { isActive: true, weightKg: null } } },
  ],
}

export default async function ProduktyPage({ searchParams }: Props) {
  const { user } = await requireAuth()
  const params = await searchParams

  const currentPage = Math.max(1, parseInt(params.strana ?? '1') || 1)
  const sort = params.sort ?? 'createdAt'
  const dir: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc'
  const currentCategoryId = params.kategorie ?? null
  const currentSearch = params.hledat ?? ''
  const missingWeightOnly = params.hmotnost === 'chybi'

  // ── Where clause ───────────────────────────────────────────────

  const where: Prisma.ProductWhereInput = {}

  if (missingWeightOnly) {
    where.AND = [MISSING_WEIGHT_WHERE]
  }

  if (currentSearch) {
    where.OR = [
      { name: { contains: currentSearch, mode: 'insensitive' } },
      { sku: { contains: currentSearch, mode: 'insensitive' } },
    ]
  }

  // Kategorie + její potomci
  let categoryFilterIds: string[] | null = null
  if (currentCategoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: currentCategoryId },
      include: { children: { select: { id: true } } },
    })
    if (cat) {
      categoryFilterIds = [cat.id, ...cat.children.map((c) => c.id)]
      where.categoryId = { in: categoryFilterIds }
    }
  }

  // ── Order by ───────────────────────────────────────────────────

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === 'name'
      ? { name: dir }
      : sort === 'sku'
        ? { sku: dir }
        : sort === 'priceWithVat'
          ? { priceWithVat: dir }
          : { createdAt: dir }

  // ── Paralelní dotazy ───────────────────────────────────────────

  const [products, total, categories, missingWeightTotal] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
      select: {
        id: true,
        sku: true,
        name: true,
        isActive: true,
        isNew: true,
        isFeatured: true,
        isOnSale: true,
        stockStatus: true,
        priceWithVat: true,
        salePriceWithVat: true,
        createdAt: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
        variants: {
          orderBy: { priceWithVat: 'asc' },
          take: 1,
          select: { priceWithVat: true },
        },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, slug: true },
        },
      },
    }),
    prisma.product.count({ where: { isActive: true, ...MISSING_WEIGHT_WHERE } }),
  ])

  // ── Serialize (Decimal → number, Date → ISO string) ───────────

  const serializedProducts: SerializedProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    isActive: p.isActive,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    isOnSale: p.isOnSale,
    stockStatus: p.stockStatus,
    priceWithVat: Number(p.priceWithVat),
    salePriceWithVat: p.salePriceWithVat ? Number(p.salePriceWithVat) : null,
    minVariantPrice: p.variants[0] ? Number(p.variants[0].priceWithVat) : null,
    hasVariants: p._count.variants > 0,
    createdAt: p.createdAt.toISOString(),
    imageUrl: p.images[0]?.url ?? null,
  }))

  const serializedCategories: SerializedCategory[] = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    children: cat.children,
  }))

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar role={user.role} currentPath="/admin/produkty" />
      <div className="flex flex-1 flex-col">
        <AdminHeader title="Přehled produktů" user={user} />
        <ProductsClient
          products={serializedProducts}
          categories={serializedCategories}
          total={total}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          currentPage={currentPage}
          sort={sort}
          dir={dir}
          currentSearch={currentSearch}
          currentCategoryId={currentCategoryId}
          missingWeightOnly={missingWeightOnly}
          missingWeightTotal={missingWeightTotal}
        />
      </div>
    </div>
  )
}
