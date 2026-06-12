/**
 * Testovací bannery pro náhled reklamních pozic na homepage.
 * Využije existující produktové fotky z R2 (nic nenahrává), vloží
 * bannery do všech 4 pozic s titulky/podtitulky.
 *
 *   npx tsx --env-file=.env scripts/seed-test-banners.ts          # vloží
 *   npx tsx --env-file=.env scripts/seed-test-banners.ts --clean  # smaže testovací
 *
 * Testovací bannery mají imageStorageKey s prefixem "__test__/" —
 * v adminu je normálně upravíte/smažete, nebo hromadně přes --clean.
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CLEAN = process.argv.includes('--clean')
const PREFIX = '__test__/'

async function main() {
  if (CLEAN) {
    const r = await prisma.banner.deleteMany({ where: { imageStorageKey: { startsWith: PREFIX } } })
    console.log(`🧹 Smazáno testovacích bannerů: ${r.count}`)
    return
  }

  // Nejdřív ukliď případné staré testovací, ať se nehromadí
  await prisma.banner.deleteMany({ where: { imageStorageKey: { startsWith: PREFIX } } })

  // Vezmi produktové fotky pro reálný náhled
  const imgs = await prisma.productImage.findMany({
    where: { isPrimary: true },
    select: { url: true, fileSize: true },
    take: 12,
  })
  if (!imgs.length) {
    console.error('❌ Žádné produktové fotky v DB — nelze vytvořit náhled.')
    process.exit(1)
  }
  const img = (i: number) => {
    const im = imgs[i % imgs.length]
    return im.fileSize > 0 ? `${im.url}?v=${im.fileSize}` : im.url
  }

  type Def = { placement: 'CAROUSEL' | 'PROMO_TILE' | 'MID_WIDE' | 'FOOTER_CARD'; title: string | null; subtitle: string | null }
  const defs: Def[] = [
    // Carousel (titulek se nezobrazuje přes obrázek — jen náhled fotky)
    { placement: 'CAROUSEL',    title: null,                 subtitle: null },
    { placement: 'CAROUSEL',    title: null,                 subtitle: null },
    // Promo dlaždice pod carouselem
    { placement: 'PROMO_TILE',  title: 'Cenové trháky týdne', subtitle: 'sleva až 53 %' },
    { placement: 'PROMO_TILE',  title: 'Čerstvé ryby',        subtitle: 'z lokálních zdrojů' },
    { placement: 'PROMO_TILE',  title: 'Grilování',           subtitle: 'víkendová nabídka' },
    { placement: 'PROMO_TILE',  title: 'Uzeniny',             subtitle: 'vlastní výroba' },
    { placement: 'PROMO_TILE',  title: 'Hovězí výběr',        subtitle: 'zrané steaky' },
    // Široký banner mezi regály
    { placement: 'MID_WIDE',    title: 'Maso přímo z farmy',  subtitle: 'doprava zdarma nad 1 500 Kč' },
    // Karty nad patičkou
    { placement: 'FOOTER_CARD', title: 'Naše tradice',        subtitle: 'rodinné lahůdkářství od 1992' },
    { placement: 'FOOTER_CARD', title: 'Provozovna',          subtitle: 'Braník, Praha 4' },
    { placement: 'FOOTER_CARD', title: 'Kontakt',             subtitle: 'objednávky online i na prodejně' },
  ]

  // sortOrder v rámci každé pozice
  const counters: Record<string, number> = {}
  const data = defs.map((d, i) => {
    const sort = counters[d.placement] ?? 0
    counters[d.placement] = sort + 1
    return {
      imageUrl: img(i),
      imageStorageKey: `${PREFIX}${d.placement.toLowerCase()}-${i}`,
      imageAlt: d.title ?? 'Testovací banner',
      placement: d.placement,
      title: d.title,
      subtitle: d.subtitle,
      linkType: 'NONE' as const,
      isVisible: true,
      sortOrder: sort,
    }
  })

  await prisma.banner.createMany({ data })

  const groups = await prisma.banner.groupBy({ by: ['placement'], _count: { _all: true } })
  console.log('✅ Testovací bannery vytvořeny:')
  for (const g of groups) console.log(`   ${g.placement}: ${g._count._all}`)
  console.log('\n   Smazání: npx tsx --env-file=.env scripts/seed-test-banners.ts --clean')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
