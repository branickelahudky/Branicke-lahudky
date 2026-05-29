'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { FlagToggle } from './FlagToggle'
import { AddProductModal } from './AddProductModal'
import { AddCategoryModal } from './AddCategoryModal'
import { formatCZK } from '@/lib/pricing'

// ── Typy ─────────────────────────────────────────────────────────

export type SerializedProduct = {
  id: string
  sku: string
  name: string
  isActive: boolean
  isNew: boolean
  isFeatured: boolean
  isOnSale: boolean
  stockStatus: string
  priceWithVat: number
  salePriceWithVat: number | null
  minVariantPrice: number | null
  hasVariants: boolean
  createdAt: string
  imageUrl: string | null
}

export type SerializedCategory = {
  id: string
  name: string
  slug: string
  children: Array<{ id: string; name: string; slug: string }>
}

interface Props {
  products: SerializedProduct[]
  categories: SerializedCategory[]
  total: number
  totalPages: number
  currentPage: number
  sort: string
  dir: 'asc' | 'desc'
  currentSearch: string
  currentCategoryId: string | null
}

// ── Konstanty ─────────────────────────────────────────────────────

const STOCK_STATUS: Record<string, { label: string; dot: string }> = {
  IN_STOCK:                { label: 'Skladem',                 dot: 'bg-green-500'  },
  LOW_STOCK:               { label: 'Poslední kusy',           dot: 'bg-orange-400' },
  OUT_OF_STOCK:            { label: 'Vyprodáno',               dot: 'bg-red-500'    },
  ON_REQUEST:              { label: 'Na dotaz',                dot: 'bg-orange-400' },
  TEMPORARILY_UNAVAILABLE: { label: 'Momentálně nedostupné',   dot: 'bg-stone-400'  },
}

// ── Helpers ───────────────────────────────────────────────────────

function ageDays(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
  if (days === 0) return 'dnes'
  if (days > 999) return '>999 d'
  return `${days} d`
}

// ── Komponenta ────────────────────────────────────────────────────

export function ProductsClient({
  products,
  categories,
  total,
  totalPages,
  currentPage,
  sort,
  dir,
  currentSearch,
  currentCategoryId,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [search, setSearch] = useState(currentSearch)
  const [catOpen, setCatOpen] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const catRef = useRef<HTMLDivElement>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)

  // Sync při navigaci zpět/vpřed
  useEffect(() => {
    setSearch(currentSearch)
  }, [currentSearch])

  // Debounce 300 ms → update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === currentSearch) return
      const params = new URLSearchParams(searchParams.toString())
      if (search) params.set('hledat', search)
      else params.delete('hledat')
      params.delete('strana')
      router.push(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Zavřít dropdown při kliknutí mimo
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── URL helpers ───────────────────────────────────────────────

  function buildUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    return `${pathname}?${params.toString()}`
  }

  function sortHref(column: string) {
    const newDir = sort === column && dir === 'asc' ? 'desc' : 'asc'
    return buildUrl({ sort: column, order: newDir, strana: null })
  }

  function pageHref(n: number) {
    return buildUrl({ strana: String(n) })
  }

  function handleCategorySelect(id: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set('kategorie', id)
    else params.delete('kategorie')
    params.delete('strana')
    router.push(`${pathname}?${params.toString()}`)
    setCatOpen(false)
  }

  function toggleExpand(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  // ── Sub-komponenty ────────────────────────────────────────────

  function SortArrow({ column }: { column: string }) {
    if (sort !== column) return <span className="ml-0.5 text-stone-300">↕</span>
    return <span className="ml-0.5 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>
  }

  const currentCatLabel = (() => {
    if (!currentCategoryId) return 'Všechny kategorie'
    for (const cat of categories) {
      if (cat.id === currentCategoryId) return cat.name
      const child = cat.children.find((c) => c.id === currentCategoryId)
      if (child) return child.name
    }
    return 'Všechny kategorie'
  })()

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
    <main className="flex-1 p-6">
      <div className="rounded-lg border border-stone-200 bg-white">

        {/* Akční lišta */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-stone-200 bg-white px-4 py-3">
          <p className="text-sm text-stone-500">
            <span className="font-medium text-stone-700">{total}</span>{' '}
            {total === 1 ? 'produkt' : total < 5 ? 'produkty' : 'produktů'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddProduct(true)}
              className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              + PŘIDAT PRODUKT
            </button>
            <button
              onClick={() => setShowAddCategory(true)}
              className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              + PŘIDAT KATEGORII
            </button>
          </div>
        </div>

        {/* Filtrační lišta */}
        <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">

          {/* Dropdown kategorií */}
          <div ref={catRef} className="relative">
            <button
              onClick={() => setCatOpen((v) => !v)}
              className="flex items-center gap-2 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              <span className={currentCategoryId ? 'font-medium text-blue-600' : ''}>
                {currentCatLabel}
              </span>
              <span className="text-stone-400 text-xs">{catOpen ? '▲' : '▼'}</span>
            </button>

            {catOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-stone-50 ${
                    !currentCategoryId ? 'font-medium text-stone-900' : 'text-stone-600'
                  }`}
                >
                  Všechny kategorie
                </button>
                <div className="my-1 border-t border-stone-100" />
                {categories.map((cat) => (
                  <div key={cat.id}>
                    <div className="flex items-center">
                      <button
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`flex-1 px-3 py-1.5 text-left text-sm hover:bg-stone-50 ${
                          currentCategoryId === cat.id
                            ? 'font-medium text-blue-600'
                            : 'text-stone-700'
                        }`}
                      >
                        {cat.name}
                      </button>
                      {cat.children.length > 0 && (
                        <button
                          onClick={() => toggleExpand(cat.id)}
                          className="px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-700"
                          title={expandedCats.has(cat.id) ? 'Sbalit' : 'Rozbalit'}
                        >
                          {expandedCats.has(cat.id) ? '▲' : '▶'}
                        </button>
                      )}
                    </div>
                    {expandedCats.has(cat.id) &&
                      cat.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => handleCategorySelect(child.id)}
                          className={`w-full py-1.5 pl-7 pr-3 text-left text-sm hover:bg-stone-50 ${
                            currentCategoryId === child.id
                              ? 'font-medium text-blue-600'
                              : 'text-stone-500'
                          }`}
                        >
                          {child.name}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vyhledávání */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat název nebo SKU…"
            className="ml-auto w-64 rounded border border-stone-300 px-3 py-1.5 text-sm placeholder-stone-400 focus:border-blue-400 focus:outline-none"
          />
        </div>

        {/* Tabulka */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="w-8 p-3">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="w-14 p-3">Foto</th>
                <th className="p-3">
                  <Link href={sortHref('name')} className="flex items-center hover:text-stone-700">
                    Název <SortArrow column="name" />
                  </Link>
                </th>
                <th className="p-3">
                  <Link href={sortHref('sku')} className="flex items-center hover:text-stone-700">
                    SKU <SortArrow column="sku" />
                  </Link>
                </th>
                <th className="p-3">Sklad</th>
                <th className="p-3">
                  <Link href={sortHref('priceWithVat')} className="flex items-center hover:text-stone-700">
                    Cena <SortArrow column="priceWithVat" />
                  </Link>
                </th>
                <th className="p-3 text-center" title="Novinka">Nov.</th>
                <th className="p-3 text-center" title="Tip">Tip</th>
                <th className="p-3 text-center" title="Akce">Akce</th>
                <th className="p-3 text-center" title="Viditelnost">Viz.</th>
                <th className="p-3 text-right">Stáří</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-stone-400">
                    Žádné produkty nenalezeny.
                  </td>
                </tr>
              )}
              {products.map((product) => {
                const stock = STOCK_STATUS[product.stockStatus] ?? {
                  label: product.stockStatus,
                  dot: 'bg-stone-300',
                }
                const displayPrice =
                  product.hasVariants && product.minVariantPrice !== null
                    ? `od ${formatCZK(product.minVariantPrice)}`
                    : formatCZK(product.priceWithVat)

                return (
                  <tr
                    key={product.id}
                    className="border-t border-stone-100 hover:bg-stone-50"
                  >
                    {/* Checkbox */}
                    <td className="p-3">
                      <input type="checkbox" className="rounded" />
                    </td>

                    {/* Foto */}
                    <td className="p-3">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-stone-100">
                          <span className="text-xs text-stone-300">?</span>
                        </div>
                      )}
                    </td>

                    {/* Název */}
                    <td className="p-3">
                      <Link
                        href={`/admin/produkty/${product.id}`}
                        className={`font-medium hover:underline ${
                          product.isActive
                            ? 'text-blue-600'
                            : 'italic text-stone-400'
                        }`}
                      >
                        {product.name}
                      </Link>
                    </td>

                    {/* SKU */}
                    <td className="p-3">
                      <span className="font-mono text-xs text-stone-500">{product.sku}</span>
                    </td>

                    {/* Sklad */}
                    <td className="p-3">
                      <span
                        title={stock.label}
                        className={`inline-block h-2.5 w-2.5 rounded-full ${stock.dot}`}
                      />
                    </td>

                    {/* Cena */}
                    <td className="p-3">
                      {product.isOnSale && product.salePriceWithVat ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-stone-400 line-through">
                            {formatCZK(product.priceWithVat)}
                          </span>
                          <span className="font-medium text-red-600">
                            {formatCZK(product.salePriceWithVat)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium text-stone-900">{displayPrice}</span>
                      )}
                    </td>

                    {/* Novinka */}
                    <td className="p-3 text-center">
                      <FlagToggle
                        productId={product.id}
                        flag="isNew"
                        value={product.isNew}
                        label="Novinka"
                      />
                    </td>

                    {/* Tip */}
                    <td className="p-3 text-center">
                      <FlagToggle
                        productId={product.id}
                        flag="isFeatured"
                        value={product.isFeatured}
                        label="Tip"
                      />
                    </td>

                    {/* Akce */}
                    <td className="p-3 text-center">
                      <FlagToggle
                        productId={product.id}
                        flag="isOnSale"
                        value={product.isOnSale}
                        label="Akce"
                      />
                    </td>

                    {/* Viditelnost */}
                    <td className="p-3 text-center">
                      <FlagToggle
                        productId={product.id}
                        flag="isActive"
                        value={product.isActive}
                        label="Viditelnost"
                      />
                    </td>

                    {/* Stáří */}
                    <td className="p-3 text-right text-xs text-stone-400">
                      {ageDays(product.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Stránkování */}
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-stone-500">
          <span>
            Strana {currentPage} z {totalPages},{' '}
            <span className="font-medium text-stone-700">{total}</span> položek celkem
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={pageHref(currentPage - 1)}
                className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50"
              >
                ← Předchozí
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={pageHref(currentPage + 1)}
                className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50"
              >
                Další →
              </Link>
            )}
          </div>
        </div>

      </div>
    </main>

    {/* Modaly */}
    {showAddProduct && (
      <AddProductModal
        categories={categories}
        onClose={() => setShowAddProduct(false)}
      />
    )}
    {showAddCategory && (
      <AddCategoryModal
        categories={categories}
        onClose={() => setShowAddCategory(false)}
        onSuccess={() => {
          setShowAddCategory(false)
          router.refresh()
        }}
      />
    )}
    </>
  )
}
