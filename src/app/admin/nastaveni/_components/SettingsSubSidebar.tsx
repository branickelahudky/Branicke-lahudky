'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Obchod',
    items: [
      { label: 'Dodavatel', href: '/admin/nastaveni/dodavatel' },
      { label: 'Provozovna', href: '/admin/nastaveni/provozovna' },
      { label: 'Daně', href: '/admin/nastaveni/dane' },
    ],
  },
  {
    label: 'Doprava a platby',
    items: [
      { label: 'Způsoby dopravy', href: '/admin/nastaveni/doprava' },
      { label: 'Způsoby platby', href: '/admin/nastaveni/platby' },
    ],
  },
  {
    label: 'Objednávky',
    items: [
      { label: 'Stavy objednávek', href: '/admin/nastaveni/stavy-objednavek' },
      { label: 'Číselné řady', href: '/admin/nastaveni/ciselne-rady' },
    ],
  },
  {
    label: 'E-maily',
    items: [
      { label: 'Odesílání', href: '/admin/nastaveni/emaily-odesilani' },
      { label: 'Šablony', href: '/admin/nastaveni/emaily-sablony' },
    ],
  },
  {
    label: 'Administrace',
    items: [
      { label: 'Správci', href: '/admin/nastaveni/spravci' },
      { label: 'Zabezpečení', href: '/admin/nastaveni/zabezpeceni' },
    ],
  },
]

export function SettingsSubSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-52 shrink-0 overflow-y-auto border-r border-stone-200 bg-white">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="px-2 py-3">
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
            {group.label}
          </p>
          {group.items.map((item) => {
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
      ))}
    </nav>
  )
}
