// Homepage - vlajková loď + nejprodávanější
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatCZK } from '@/lib/pricing'

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true, publishedAt: { lte: new Date() } },
      take: 8,
      include: {
        category: { select: { slug: true, name: true } },
        images: { where: { isPrimary: true }, take: 1 },
      },
    }),
    prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
  ])

  return (
    <main>
      {/* Hero */}
      <section className="bg-brand-cream border-b border-brand-ink/20">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <p className="text-xs tracking-[0.3em] text-brand-ink/70">PRAHA · BRANÍK · OD 1991</p>
          <h1 className="mt-3 text-5xl font-bold text-brand-ink">Branické lahůdkářství</h1>
          <p className="mt-3 text-sm tracking-widest text-brand-ink/80">
            MASO · UZENINY · LAHŮDKY
          </p>
          <div className="mt-8 inline-flex items-center gap-3 bg-brand-red px-8 py-3 text-brand-cream">
            <span className="text-xs tracking-widest">NAŠE VLAJKOVÁ LOĎ</span>
          </div>
          <p className="mt-4 font-serif text-2xl italic text-brand-ink">
            Originál New York Pastrami
          </p>
        </div>
      </section>

      {/* Kategorie */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-semibold">Nakupujte podle kategorie</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/kategorie/${c.slug}`}
              className="block rounded-lg border border-stone-200 bg-white p-4 text-center transition hover:border-brand-red hover:shadow-sm"
            >
              <p className="font-medium">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Vlajkové produkty */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-semibold">Doporučujeme</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <Link
              key={p.id}
              href={`/produkty/${p.slug}`}
              className="group block rounded-lg border border-stone-200 bg-white p-4 transition hover:shadow-md"
            >
              <div className="aspect-square rounded bg-stone-100" />
              <p className="mt-3 text-xs text-stone-500">{p.category.name}</p>
              <h3 className="font-medium">{p.name}</h3>
              <p className="mt-1 text-sm text-stone-600">{p.shortDescription}</p>
              <p className="mt-2 font-semibold text-brand-red">
                {p.isWeightBased ? 'od ' : ''}
                {formatCZK(Number(p.priceWithVat))}
                {p.unit === 'KG' && ' / kg'}
                {p.unit === 'G_100' && ' / 100 g'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-stone-600">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="font-semibold text-brand-ink">Branické lahůdkářství</p>
              <p>Branická 75, Praha 4, 140 00</p>
              <p>+420 731 862 387</p>
              <p>branickelahudky@gmail.com</p>
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Obchod</p>
              <p>Doručíme do druhého dne po Praze</p>
              <p>Doprava zdarma od 1 500 Kč</p>
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Rodinný obchod od roku 1991</p>
              <p>Provozováno bratry Markesovými</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
