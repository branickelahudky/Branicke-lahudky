import Link from 'next/link'

// Záložky sekce účtu — server komponenta, aktivní stav podle prop.
export function AccountNav({ active }: { active: 'profil' | 'objednavky' }) {
  const tab = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        isActive
          ? 'bg-gold text-white'
          : 'border border-stone-200 text-shop-muted hover:border-gold hover:text-gold'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="flex flex-wrap gap-2">
      {tab('/ucet', 'Můj účet', active === 'profil')}
      {tab('/ucet/objednavky', 'Objednávky', active === 'objednavky')}
    </nav>
  )
}
