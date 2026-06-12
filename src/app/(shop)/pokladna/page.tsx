import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Pokladna',
  robots: { index: false },
}

export default async function PokladnaPage() {
  const branch = await prisma.branchSettings.findFirst()

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="mb-4 text-5xl">🧾</p>
        <h1 className="text-2xl font-bold text-shop-fg">Pokladnu připravujeme</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-shop-muted">
          Online dokončení objednávky teď ladíme. Objednávky zatím vyřizujeme
          telefonicky nebo přímo na prodejně — rádi vám pomůžeme.
        </p>

        {branch && (
          <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm">
            <p className="font-semibold text-shop-fg">{branch.name}</p>
            {(branch.phone1 || branch.phone2) && (
              <p className="text-shop-muted">
                Telefon:{' '}
                {branch.phone1 && (
                  <a href={`tel:${branch.phone1.replace(/\s+/g, '')}`} className="font-medium text-gold hover:underline">
                    {branch.phone1}
                  </a>
                )}
                {branch.phone1 && branch.phone2 && <span>, </span>}
                {branch.phone2 && (
                  <a href={`tel:${branch.phone2.replace(/\s+/g, '')}`} className="font-medium text-gold hover:underline">
                    {branch.phone2}
                  </a>
                )}
              </p>
            )}
            {branch.email && (
              <p className="text-shop-muted">
                E-mail:{' '}
                <a href={`mailto:${branch.email}`} className="font-medium text-gold hover:underline">
                  {branch.email}
                </a>
              </p>
            )}
            <p className="text-shop-muted">
              {branch.street}, {branch.zip} {branch.city}
            </p>
          </div>
        )}

        <Link href="/"
          className="mt-8 inline-block rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-shop-fg transition hover:border-gold hover:text-gold">
          Zpět do obchodu
        </Link>
      </div>
    </div>
  )
}
