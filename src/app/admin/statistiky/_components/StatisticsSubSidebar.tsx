'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Obrat a tržby', href: '/admin/statistiky' },
  { label: 'Objednávky', href: '/admin/statistiky/objednavky' },
  { label: 'Produkty', href: '/admin/statistiky/produkty' },
  { label: 'Zákazníci', href: '/admin/statistiky/zakaznici' },
  { label: 'Finance', href: '/admin/statistiky/finance' },
  { label: 'Sklad', href: '/admin/statistiky/sklad' },
]

export function StatisticsSubSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-52 shrink-0 overflow-y-auto border-r border-stone-200 bg-white">
      <div className="px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
