/**
 * DRY-RUN v2: Bezpečný plán úklidu duplicitních kategorií.
 * POUZE ČTENÍ — žádný prisma.update/delete/create.
 * Použití: npx tsx --env-file=.env scripts/cleanup-categories-dryrun-v2.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── SEED kategorie (krátké slugy) — identifikace dle slug patternu ─

const SEED_ROOT_SLUGS   = ['drubez', 'hovezi', 'veprove', 'uzeniny', 'lahudky', 'ryby']
const KEEP_SEED_SLUGS   = ['uzeniny', 'lahudky']   // zachovat + povýšit
const DELETE_SEED_ROOTS = ['drubez', 'hovezi', 'veprove', 'ryby']

// Jasné přesuny (SKU → IMPORT slug cíle)
const CLEAR_MOVES: Array<{ sku: string; targetImportSlug: string }> = [
  { sku: '243', targetImportSlug: 'drubezi-maso' },
  { sku: '240', targetImportSlug: 'drubezi-maso' },
]

type Cat = {
  id: string; name: string; slug: string
  parentId: string | null; sortOrder: number; productCount: number
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║   DRY-RUN v2: Bezpečný úklid duplicitních kategorií         ║')
  console.log('║   POUZE ČTENÍ — žádný zápis, mazání ani změna dat           ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log('║   ŽELEZNÉ PRAVIDLO: Maže se POUZE kategorie, na které       ║')
  console.log('║   (ani v jejím podstromu) nevisí ani jeden produkt.         ║')
  console.log('║   Cokoliv s ≥1 produktem se NEMAŽE.                         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // Načti všechny kategorie
  const rawCats = await prisma.category.findMany({
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, parentId: true, sortOrder: true,
              _count: { select: { products: true } } },
  })
  const cats: Cat[] = rawCats.map(c => ({
    id: c.id, name: c.name, slug: c.slug, parentId: c.parentId,
    sortOrder: c.sortOrder, productCount: c._count.products,
  }))

  const byId   = new Map(cats.map(c => [c.id, c]))
  const bySlug = new Map(cats.map(c => [c.slug, c]))

  // Rekurzivní sběr potomků
  function descendants(catId: string): Cat[] {
    const children = cats.filter(c => c.parentId === catId)
    return [...children, ...children.flatMap(c => descendants(c.id))]
  }

  // Celkový počet produktů v podstromu
  function subtreeCount(cat: Cat): number {
    return cat.productCount + descendants(cat.id).reduce((s, c) => s + c.productCount, 0)
  }

  // ── 1. PŘESUN PRODUKTŮ ─────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('1. PŘESUN PRODUKTŮ (jasná párování)')
  console.log('════════════════════════════════════════════════════════════════\n')

  const movedProductIds = new Set<string>()

  for (const move of CLEAR_MOVES) {
    const product = await prisma.product.findFirst({
      where: { sku: move.sku },
      select: { id: true, name: true, sku: true, categoryId: true },
    })
    const targetCat = bySlug.get(move.targetImportSlug)

    if (!product) {
      console.log(`  ⚠️  Produkt SKU "${move.sku}" NENALEZEN v DB`)
      continue
    }
    const fromCat = byId.get(product.categoryId)

    if (!targetCat) {
      console.log(`  ⚠️  Cílová IMPORT kategorie "${move.targetImportSlug}" NENALEZENA`)
      continue
    }

    console.log(`  ✓ „${product.name}" (SKU ${product.sku})`)
    console.log(`      ZE:  ${fromCat?.name ?? '?'} (slug: ${fromCat?.slug ?? '?'}, id: ${product.categoryId})`)
    console.log(`      DO:  ${targetCat.name} (slug: ${targetCat.slug}, id: ${targetCat.id})`)
    movedProductIds.add(product.id)
    console.log()
  }

  // ── 2. ZACHOVÁNÍ A POVÝŠENÍ ────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('2. ZACHOVÁNÍ A POVÝŠENÍ DVOU SEED KATEGORIÍ (parentId → null)')
  console.log('════════════════════════════════════════════════════════════════\n')

  for (const slug of KEEP_SEED_SLUGS) {
    const cat = bySlug.get(slug)
    if (!cat) { console.log(`  ⚠️  Kategorie "${slug}" nenalezena`); continue }

    const isAlreadyRoot = cat.parentId === null
    const productsHere = await prisma.product.findMany({
      where: { categoryId: cat.id },
      select: { id: true, name: true, sku: true },
    })

    console.log(`  📌 ZACHOVAT: „${cat.name}" (slug: ${cat.slug}, id: ${cat.id})`)
    console.log(`      Aktuálně ${isAlreadyRoot ? 'JIŽ kořenová' : `podkategorie (parentId: ${cat.parentId})`}`)
    if (!isAlreadyRoot) {
      console.log(`      → AKCE: nastavit parentId = null (povýšit na kořen)`)
    } else {
      console.log(`      → AKCE: žádná (již je kořen)`)
    }
    console.log(`      Produkty, které ZDE ZŮSTANOU (${productsHere.length} ks):`)
    if (productsHere.length === 0) {
      console.log('        (žádné)')
    } else {
      for (const p of productsHere) {
        console.log(`        • „${p.name}" (SKU ${p.sku})`)
      }
    }
    console.log()
  }

  // ── 3. MAZÁNÍ — POUZE PRÁZDNÉ SEED KATEGORIE ──────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('3. MAZÁNÍ — POUZE PRÁZDNÉ SEED KATEGORIE')
  console.log('════════════════════════════════════════════════════════════════\n')

  // Sbere všechny SEED kategorie ke zvážení smazání (ne KEEP)
  const seedCandidates: Cat[] = []
  for (const rootSlug of DELETE_SEED_ROOTS) {
    const root = bySlug.get(rootSlug)
    if (!root) continue
    seedCandidates.push(root, ...descendants(root.id))
  }
  // Přidej podkategorie KEEP kořenů (ty se mohou smazat pokud jsou prázdné)
  for (const slug of KEEP_SEED_SLUGS) {
    const cat = bySlug.get(slug)
    if (!cat) continue
    // Podkategorie SEED uzeniny/lahudky (krátké slugy)
    const seedChildren = descendants(cat.id).filter(c =>
      !c.slug.startsWith(cat.slug + '-') // IMPORT children mají prefix
    )
    seedCandidates.push(...seedChildren)
  }

  // Odeber duplicity
  const candidateMap = new Map(seedCandidates.map(c => [c.id, c]))

  // Zkontroluj vazby (menu, banner, homepage)
  const candidateIds = [...candidateMap.keys()]
  const menuRefs = await prisma.menuItem.findMany({
    where: { categoryId: { in: candidateIds } },
    select: { id: true, label: true, categoryId: true },
  })
  const bannerRefs = await prisma.banner.findMany({
    where: { categoryId: { in: candidateIds } },
    select: { id: true, categoryId: true },
  })
  const homepageSections = await prisma.homepageSection.findMany({
    where: { type: 'FEATURED_CATEGORIES' },
    select: { config: true },
  })
  const homepageCatIds = new Set(
    homepageSections.flatMap(s => ((s.config as { categoryIds?: string[] })?.categoryIds ?? []))
  )

  const menuByCat   = new Map<string, string[]>()
  const bannerByCat = new Map<string, number>()
  for (const m of menuRefs) { const a = menuByCat.get(m.categoryId!) ?? []; a.push(m.label); menuByCat.set(m.categoryId!, a) }
  for (const b of bannerRefs) { bannerByCat.set(b.categoryId!, (bannerByCat.get(b.categoryId!) ?? 0) + 1) }

  // Simuluj stav po přesunech: produkty přesunuté z kategorie (movedProductIds)
  async function productsAfterMove(catId: string): Promise<Array<{ name: string; sku: string }>> {
    const all = await prisma.product.findMany({
      where: { categoryId: catId },
      select: { id: true, name: true, sku: true },
    })
    return all.filter(p => !movedProductIds.has(p.id))
  }

  let toDelete: Cat[] = []
  let toKeepDirty: Array<{ cat: Cat; reason: string }> = []

  // Zpracuj každou kandidátní kategorii — od listů nahoru (reverse order = děti dříve)
  const ordered = [...candidateMap.values()].sort((a, b) => {
    // Děti (s parentId) dříve než rodiče
    const aDepth = a.parentId ? 1 : 0
    const bDepth = b.parentId ? 1 : 0
    return bDepth - aDepth
  })

  for (const cat of ordered) {
    // Přeskočit KEEP kořeny (uzeniny, lahudky)
    if (KEEP_SEED_SLUGS.includes(cat.slug)) continue

    const productsAfter = await productsAfterMove(cat.id)
    const descCats       = descendants(cat.id)
    const descProductsAfter: Array<{ name: string; sku: string }> = []
    for (const dc of descCats) {
      if (candidateMap.has(dc.id) && !KEEP_SEED_SLUGS.includes(dc.slug)) {
        const dp = await productsAfterMove(dc.id)
        descProductsAfter.push(...dp)
      }
    }

    const totalAfter    = productsAfter.length + descProductsAfter.length
    const menuLinks     = menuByCat.get(cat.id) ?? []
    const bannerCount   = bannerByCat.get(cat.id) ?? 0
    const inHomepage    = homepageCatIds.has(cat.id)

    const warnings: string[] = []
    if (menuLinks.length)  warnings.push(`MenuItem: "${menuLinks.join('", "')}"`)
    if (bannerCount)       warnings.push(`Banner (${bannerCount} ks)`)
    if (inHomepage)        warnings.push('HomepageSection FEATURED_CATEGORIES')

    if (totalAfter > 0) {
      toKeepDirty.push({
        cat,
        reason: `drží ${totalAfter} produkt(ů): ${[...productsAfter, ...descProductsAfter].map(p => `„${p.name}"`).join(', ')}`,
      })
      console.log(`  ⚠️  NEMAZAT: „${cat.name}" (slug: ${cat.slug})`)
      console.log(`      Drží po přesunech ${totalAfter} produkt(ů): ${[...productsAfter, ...descProductsAfter].map(p => p.name).join(', ')}`)
      if (warnings.length) console.log(`      Vazby: ${warnings.join(', ')}`)
      console.log()
    } else {
      toDelete.push(cat)
      const warnStr = warnings.length ? `  ⚠️  POZOR: odkazuje ${warnings.join(', ')}` : ''
      console.log(`  🗑️  SMAZAT: „${cat.name}" (slug: ${cat.slug}, id: ${cat.id})`)
      console.log(`      Důkaz: 0 produktů přímo, 0 v podstromu → bezpečné smazat`)
      if (warnStr) console.log(`      ${warnStr}`)
      console.log()
    }
  }

  // ── 4. KONTROLA VAZEB ─────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('4. KONTROLA VAZEB (menu / bannery / homepage)')
  console.log('════════════════════════════════════════════════════════════════\n')

  const deleteIds = new Set(toDelete.map(c => c.id))
  const problemLinks = [...menuRefs.filter(m => deleteIds.has(m.categoryId!)),
                        ...bannerRefs.filter(b => deleteIds.has(b.categoryId!))]
  const homepageConflicts = [...deleteIds].filter(id => homepageCatIds.has(id))

  if (problemLinks.length === 0 && homepageConflicts.length === 0) {
    console.log('  ✓ Žádné vazby na mazané kategorie — úklid nerozbije menu/bannery/homepage.\n')
  } else {
    if (menuRefs.filter(m => deleteIds.has(m.categoryId!)).length) {
      console.log('  ⚠️  MenuItem odkazuje na mazané kategorie:')
      menuRefs.filter(m => deleteIds.has(m.categoryId!)).forEach(m => {
        const cat = byId.get(m.categoryId!)
        console.log(`      • MenuItem „${m.label}" → kategorie „${cat?.name}" (${cat?.slug})`)
      })
    }
    if (homepageConflicts.length) {
      console.log('  ⚠️  HomepageSection FEATURED_CATEGORIES obsahuje ID mazaných kategorií:')
      homepageConflicts.forEach(id => { const cat = byId.get(id); console.log(`      • ${cat?.name} (${cat?.slug})`) })
    }
    console.log()
  }

  // ── 5. SOUHRN ─────────────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('5. SOUHRN')
  console.log('════════════════════════════════════════════════════════════════\n')

  console.log(`  Přesunuto produktů (jasné párování)   : ${movedProductIds.size}`)
  console.log()

  for (const slug of KEEP_SEED_SLUGS) {
    const cat = bySlug.get(slug)
    if (!cat) continue
    const prods = await prisma.product.findMany({ where: { categoryId: cat.id }, select: { name: true } })
    console.log(`  Zachováno a povýšeno: „${cat.name}" (${slug}) — ${prods.length} produkt(ů)`)
  }
  console.log()

  console.log(`  Kategorií ke smazání (prázdné)         : ${toDelete.length}`)
  toDelete.forEach(c => console.log(`      • ${c.name} (${c.slug})`))
  console.log()

  console.log(`  Kategorií NEMAZAT kvůli produktům      : ${toKeepDirty.length}`)
  toKeepDirty.forEach(({ cat, reason }) => console.log(`      • ${cat.name} (${cat.slug}): ${reason}`))
  console.log()

  // Simulovaný finální stav kořenových kategorií
  console.log('  Simulovaný finální stav KOŘENOVÝCH kategorií po úklidu:')
  const deleteIdsSet = new Set(toDelete.map(c => c.id))
  const rootsAfter = cats.filter(c => !c.parentId && !deleteIdsSet.has(c.id))
  // Přidej KEEP kategorie (pokud nejsou kořen)
  for (const slug of KEEP_SEED_SLUGS) {
    const cat = bySlug.get(slug)
    if (cat && !rootsAfter.find(r => r.id === cat.id)) rootsAfter.push(cat)
  }
  rootsAfter.sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  rootsAfter.forEach(c => {
    const isSeed   = SEED_ROOT_SLUGS.includes(c.slug)
    const isKept   = KEEP_SEED_SLUGS.includes(c.slug)
    const tag      = isKept ? ' [SEED→zachován]' : isSeed ? ' [SEED]' : ' [IMPORT]'
    console.log(`      • ${c.name} (${c.slug})${tag}`)
  })

  console.log()
  console.log('════════════════════════════════════════════════════════════════')
  console.log('=== DRY-RUN v2. NIC NEBYLO ZMĚNĚNO. ===')
  console.log('════════════════════════════════════════════════════════════════')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Chyba:', err)
  await prisma.$disconnect()
  process.exit(1)
})
