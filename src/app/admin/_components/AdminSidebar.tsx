import Link from 'next/link'
import { AdminRole } from '@prisma/client'

const NAV_ITEMS: { label: string; href: string; roles: AdminRole[] }[] = [
  { label: 'Základní přehled', href: '/admin', roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { label: 'Objednávky', href: '/admin/objednavky', roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { label: 'Produkty', href: '/admin/produkty', roles: ['OWNER'] },
  { label: 'Zákazníci', href: '/admin/zakaznici', roles: ['OWNER', 'ADMIN'] },
  { label: 'Faktury', href: '/admin/faktury', roles: ['OWNER', 'ADMIN'] },
  { label: 'Statistiky', href: '/admin/statistiky', roles: ['OWNER', 'ADMIN'] },
  { label: 'Nastavení', href: '/admin/nastaveni', roles: ['OWNER'] },
]

interface Props {
  role: AdminRole
  currentPath: string
}

export function AdminSidebar({ role, currentPath }: Props) {
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside className="w-60 shrink-0 border-r border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <p className="font-semibold text-brand-red">Branické lahůdkářství</p>
        <p className="text-xs text-stone-500">Administrace</p>
      </div>
      <nav className="flex flex-col gap-1 p-2 text-sm">
        {visibleNav.map((item) => {
          const isActive =
            currentPath === item.href || currentPath.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 transition ${
                isActive
                  ? 'bg-brand-red/10 font-medium text-brand-red'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
