import Link from 'next/link'
import { AdminRole } from '@prisma/client'

type NavLink = {
  kind: 'link'
  label: string
  href: string
  roles: AdminRole[]
}

type NavSection = {
  kind: 'section'
  label: string
  roles: AdminRole[]
  items: { label: string; href: string }[]
}

type NavEntry = NavLink | NavSection

const NAV: NavEntry[] = [
  { kind: 'link', label: 'Základní přehled', href: '/admin',            roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { kind: 'link', label: 'Objednávky',        href: '/admin/objednavky', roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { kind: 'link', label: 'Produkty',          href: '/admin/produkty',   roles: ['OWNER'] },
  { kind: 'link', label: 'Zákazníci',         href: '/admin/zakaznici',  roles: ['OWNER', 'ADMIN'] },
  { kind: 'link', label: 'Faktury',           href: '/admin/faktury',    roles: ['OWNER', 'ADMIN'] },
  { kind: 'link', label: 'Statistiky',        href: '/admin/statistiky', roles: ['OWNER', 'ADMIN'] },
  { kind: 'link', label: 'Nastavení',         href: '/admin/nastaveni',  roles: ['OWNER'] },
  {
    kind: 'section',
    label: 'Vzhled webu',
    roles: ['OWNER'],
    items: [
      { label: 'Stránky',            href: '/admin/vzhled/stranky' },
      { label: 'Menu',               href: '/admin/vzhled/menu' },
      { label: 'Identita & patička', href: '/admin/vzhled/identita' },
      { label: 'Cookies',            href: '/admin/vzhled/cookies' },
    ],
  },
]

interface Props {
  role: AdminRole
  currentPath: string
}

export function AdminSidebar({ role, currentPath }: Props) {
  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + '/')
  }

  const linkCls = (href: string) =>
    `block rounded px-3 py-2 text-sm transition ${
      isActive(href)
        ? 'bg-brand-red/10 font-medium text-brand-red'
        : 'text-stone-700 hover:bg-stone-100'
    }`

  const subLinkCls = (href: string) =>
    `block rounded px-3 py-1.5 text-sm transition ${
      isActive(href)
        ? 'bg-brand-red/10 font-medium text-brand-red'
        : 'text-stone-600 hover:bg-stone-100'
    }`

  return (
    <aside className="w-60 shrink-0 border-r border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <p className="font-semibold text-brand-red">Branické lahůdkářství</p>
        <p className="text-xs text-stone-500">Administrace</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV.map((entry) => {
          if (!entry.roles.includes(role)) return null

          if (entry.kind === 'link') {
            return (
              <Link key={entry.href} href={entry.href} className={linkCls(entry.href)}>
                {entry.label}
              </Link>
            )
          }

          // Section
          const visibleItems = entry.items
          if (visibleItems.length === 0) return null

          return (
            <div key={entry.label} className="mt-2">
              <p className="mb-0.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-stone-400">
                {entry.label}
              </p>
              {visibleItems.map((item) => (
                <Link key={item.href} href={item.href} className={subLinkCls(item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
