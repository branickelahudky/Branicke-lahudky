'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface SubCategory {
  id: string
  name: string
  slug: string
  count: number
}

interface Props {
  categorySlug: string
  subcategories: SubCategory[]
  activeSub: string | null
  totalLabel: string
}

export function CategorySidebar({ categorySlug, subcategories, activeSub, totalLabel }: Props) {
  const searchParams = useSearchParams()
  const currentSub = searchParams.get('sub') ?? activeSub

  const linkCls = (active: boolean) =>
    `flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
      active
        ? 'bg-gold/10 font-semibold text-gold'
        : 'text-stone-300 hover:text-gold hover:bg-shop-card'
    }`

  return (
    <nav className="flex flex-col gap-0.5">
      <Link href={`/kategorie/${categorySlug}`} className={linkCls(!currentSub)}>
        <span>{totalLabel}</span>
      </Link>
      {subcategories.map((c) => (
        <Link
          key={c.id}
          href={`/kategorie/${categorySlug}?sub=${c.slug}`}
          className={linkCls(currentSub === c.slug)}
        >
          <span>{c.name}</span>
          {c.count > 0 && (
            <span className="text-xs text-shop-muted">{c.count}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}
