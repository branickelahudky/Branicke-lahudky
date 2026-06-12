/**
 * DRY-RUN: Plán úklidu duplicitních kategorií.
 * POUZE ČTENÍ — žádný zápis, mazání ani změna dat.
 * Použití: npx tsx scripts/cleanup-categories-dryrun.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Pomocné typy ──────────────────────────────────────────────────

type Cat = {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  productCount: number
}

// ── Identifikace stromu ───────────────────────────────────────────
// SEED strom: slugy krátké, bez '-maso' nebo '-meso' a bez prefixu názvu rodiče
// IMPORT strom: slugy obsahují pomlčkový prefix rodičovské kategorie nebo '-maso'

function classifySlug(slug: string, parentSlug: string | null): 'SEED' | 'IMPORT' {
  // Kořenové kategorie: IMPORT mají v slugu '-maso', '-meso' nebo jiný deskriptivní suffix
  if (!parentSlug) {
    // Krátké jednoslovné slugy = SEED
    if (/^[a-z]+$/.test(slug)) return 'SEED'
    return 'IMPORT'
  }
  // Podkategorie: IMPORT mají slug = prefixParent-neco (začínají slugem rodiče)
  if (parentSlug && slug.startsWith(parentSlug + '-')) return 'IMPORT'
  // Jinak SEED
  return 'SEED'
}

// ── Navrhni párování SEED→IMPORT dle názvu ───────────────────────

function suggestImportMatch(seedCat: Cat, importCats: Cat[]): Cat | null {
  // Přesná shoda jména (case insensitive)
  const exact = importCats.find(
    (ic) => ic.name.toLowerCase() === seedCat.name.toLowerCase() && ic.id !== seedCat.id
  )
  return exact ?? null
}

// ── Hlavní ───────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║       DRY-RUN: Úklid duplicitních kategorií          ║')
  console.log('║       POUZE ČTENÍ — nic se nemění                    ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  // Načti všechny kategorie s počtem produktů
  const rawCats = await prisma.category.findMany({
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true, name: true, slug: true, parentId: true, sortOrder: true,
      _count: { select: { products: true } },
    },
  })

  const cats: Cat[] = rawCats.map((c) => ({
    id: c.id, name: c.name, slug: c.slug, parentId: c.parentId,
    sortOrder: c.sortOrder, productCount: c._count.products,
  }))

  // Zjisti slug rodiče
  const slugById = new Map(cats.map((c) => [c.id, c.slug]))

  // Klasifikuj všechny kategorie
  const classified = cats.map((c) => ({
    ...c,
    type: classifySlug(c.slug, c.parentId ? (slugById.get(c.parentId) ?? null) : null) as 'SEED' | 'IMPORT',
  }))

  const seedCats  = classified.filter((c) => c.type === 'SEED')
  const importCats = classified.filter((c) => c.type === 'IMPORT')

  // ── 1. IDENTIFIKACE STROMŮ ──────────────────────────────────────

  console.log('════════════════════════════════════════════════════════')
  console.log('1. IDENTIFIKACE STROMŮ')
  console.log('════════════════════════════════════════════════════════\n')

  console.log('── SEED strom (krátké slugy) — ke smazání ──────────────')
  const seedRoots   = seedCats.filter((c) => !c.parentId)
  const seedChildren = seedCats.filter((c) => c.parentId)

  for (const root of seedRoots) {
    console.log(`  [SEED] ${root.name}  slug:${root.slug}  id:${root.id}  produkty:${root.productCount}`)
    const kids = seedChildren.filter((c) => c.parentId === root.id)
    for (const kid of kids) {
      console.log(`    └─ ${kid.name}  slug:${kid.slug}  id:${kid.id}  produkty:${kid.productCount}`)
    }
  }

  console.log('\n── IMPORT strom (prefixové slugy) — zůstává ─────────────')
  const importRoots    = importCats.filter((c) => !c.parentId)
  const importChildren = importCats.filter((c) => c.parentId)

  for (const root of importRoots) {
    const kids = importChildren.filter((c) => c.parentId === root.id)
    console.log(`  [IMPORT] ${root.name}  slug:${root.slug}  id:${root.id}  produkty:${root.productCount}`)
    for (const kid of kids) {
      console.log(`    └─ ${kid.name}  slug:${kid.slug}  id:${kid.id}  produkty:${kid.productCount}`)
      // Vnořené podkategorie (level 3)
      const grandkids = importChildren.filter((c) => c.parentId === kid.id)
      for (const gk of grandkids) {
        console.log(`       └─ ${gk.name}  slug:${gk.slug}  id:${gk.id}  produkty:${gk.productCount}`)
      }
    }
  }

  // ── 2. PLÁN PŘESUNU PRODUKTŮ ────────────────────────────────────

  console.log('\n════════════════════════════════════════════════════════')
  console.log('2. PLÁN PŘESUNU PRODUKTŮ')
  console.log('════════════════════════════════════════════════════════\n')

  // Načti produkty ve SEED kategoriích
  const seedCatIds = seedCats.map((c) => c.id)
  const productsInSeed = await prisma.product.findMany({
    where: { categoryId: { in: seedCatIds } },
    select: { id: true, name: true, sku: true, categoryId: true },
    orderBy: { name: 'asc' },
  })

  let clearCount  = 0
  let unclearCount = 0
  const unclearProducts: typeof productsInSeed = []
  const moveMap: Array<{ product: typeof productsInSeed[0]; from: Cat; to: Cat }> = []

  for (const prod of productsInSeed) {
    const fromCat = seedCats.find((c) => c.id === prod.categoryId)!
    const match   = suggestImportMatch(fromCat, importCats)

    if (match) {
      console.log(`  ✓ „${prod.name}" (${prod.sku})`)
      console.log(`      ze  SEED:[${fromCat.name}] (${fromCat.slug})`)
      console.log(`      do IMPORT:[${match.name}] (${match.slug})`)
      moveMap.push({ product: prod, from: fromCat, to: match })
      clearCount++
    } else {
      console.log(`  ⚠️  NEJASNÉ PÁROVÁNÍ — potřebuje ruční rozhodnutí`)
      console.log(`      Produkt: „${prod.name}" (${prod.sku})`)
      console.log(`      Kategorie: SEED:[${fromCat.name}] (${fromCat.slug})`)
      console.log(`      → Žádná IMPORT kategorie se stejným názvem nenalezena.`)
      unclearProducts.push(prod)
      unclearCount++
    }
    console.log()
  }

  if (productsInSeed.length === 0) {
    console.log('  (Žádné produkty ve SEED kategoriích — není co přesouvat)\n')
  }

  // ── 3. PLÁN MAZÁNÍ KATEGORIÍ ────────────────────────────────────

  console.log('════════════════════════════════════════════════════════')
  console.log('3. PLÁN MAZÁNÍ KATEGORIÍ')
  console.log('════════════════════════════════════════════════════════\n')

  // Ověř vazby z menu, bannerů, homepage
  const menuItems = await prisma.menuItem.findMany({
    where: { categoryId: { in: seedCatIds } },
    select: { id: true, label: true, categoryId: true },
  })
  const banners = await prisma.banner.findMany({
    where: { categoryId: { in: seedCatIds } },
    select: { id: true, imageAlt: true, categoryId: true },
  })
  const homepageSections = await prisma.homepageSection.findMany({
    where: { type: 'FEATURED_CATEGORIES' },
    select: { id: true, config: true, title: true },
  })

  // Parsuj categoryIds z homepage config
  const homepageCategoryIds = new Set<string>()
  for (const s of homepageSections) {
    const cfg = (s.config ?? {}) as { categoryIds?: string[] }
    for (const id of cfg.categoryIds ?? []) homepageCategoryIds.add(id)
  }

  const menuByCatId  = new Map<string, typeof menuItems>()
  const bannerByCatId = new Map<string, typeof banners>()
  for (const m of menuItems) {
    const arr = menuByCatId.get(m.categoryId!) ?? []
    arr.push(m); menuByCatId.set(m.categoryId!, arr)
  }
  for (const b of banners) {
    const arr = bannerByCatId.get(b.categoryId!) ?? []
    arr.push(b); bannerByCatId.set(b.categoryId!, arr)
  }

  // Kolik produktů zůstane po přesunu (producty s nejasným párováním zůstávají)
  const unclearCatIds = new Set(unclearProducts.map((p) => p.categoryId))

  let deleteCount   = 0
  let keepCount     = 0

  for (const cat of seedCats) {
    const hasUnclear     = unclearCatIds.has(cat.id)
    const menuRefs       = menuByCatId.get(cat.id) ?? []
    const bannerRefs     = bannerByCatId.get(cat.id) ?? []
    const inHomepage     = homepageCategoryIds.has(cat.id)

    const warnings: string[] = []
    if (hasUnclear)       warnings.push('⚠️  NEMAZAT zatím — produkt s nejasným párováním')
    if (menuRefs.length)  warnings.push(`⚠️  POZOR: odkazuje z MenuItem (${menuRefs.map(m => `"${m.label}"`).join(', ')})`)
    if (bannerRefs.length) warnings.push(`⚠️  POZOR: odkazuje z Banner (${bannerRefs.length} ks)`)
    if (inHomepage)       warnings.push('⚠️  POZOR: odkazuje z HomepageSection FEATURED_CATEGORIES')

    // Podkategorie SEED pod touto kategorií
    const childSeedCats = seedCats.filter((c) => c.parentId === cat.id)

    const canDelete = warnings.length === 0 || !hasUnclear

    console.log(`  ${warnings.length === 0 ? '🗑️  SMAZAT' : '⛔  NEMAZAT zatím'}: ${cat.name}`)
    console.log(`      slug:${cat.slug}  id:${cat.id}  produkty po přesunu: ${hasUnclear ? '⚠️ BUDE MÍT PRODUKTY' : '0'}`)
    for (const w of warnings) console.log(`      ${w}`)
    if (childSeedCats.length) {
      console.log(`      Podkategorie SEED ke smazání spolu s ní: ${childSeedCats.map(c => c.slug).join(', ')}`)
    }
    console.log()

    if (warnings.length === 0) deleteCount++
    else keepCount++
  }

  // ── 4. SOUHRN ────────────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════')
  console.log('4. SOUHRN')
  console.log('════════════════════════════════════════════════════════\n')

  console.log(`  Produkty k přesunu (jasné párování)    : ${clearCount}`)
  console.log(`  Produkty s nejasným párováním           : ${unclearCount}`)
  if (unclearCount > 0) {
    console.log('    └─ Produkty bez jasného párování:')
    for (const p of unclearProducts) {
      const cat = seedCats.find((c) => c.id === p.categoryId)
      console.log(`       • „${p.name}" (${p.sku}) v kategorii ${cat?.name} (${cat?.slug})`)
    }
  }
  console.log(`  Kategorie ke smazání                   : ${deleteCount}`)
  console.log(`  Kategorie „nemazat zatím"              : ${keepCount}`)
  console.log()

  const allMenuRefs = menuItems.length
  const allBannerRefs = banners.length
  const allHomepageRefs = [...homepageCategoryIds].filter((id) => seedCatIds.includes(id)).length

  if (allMenuRefs || allBannerRefs || allHomepageRefs) {
    console.log('  Vazby které bude třeba ošetřit:')
    if (allMenuRefs)    console.log(`    • MenuItem: ${allMenuRefs} položka/položky odkazují na SEED kategorie`)
    if (allBannerRefs)  console.log(`    • Banner: ${allBannerRefs} banner/bannery odkazují na SEED kategorie`)
    if (allHomepageRefs) console.log(`    • HomepageSection: ${allHomepageRefs} ID ze SEED ve FEATURED_CATEGORIES config`)
  } else {
    console.log('  Žádné vazby menu/banner/homepage na SEED kategorie ✓')
  }

  console.log()
  console.log('════════════════════════════════════════════════════════')
  console.log('=== TOTO BYL DRY-RUN. NIC NEBYLO ZMĚNĚNO. ===')
  console.log('════════════════════════════════════════════════════════')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Chyba:', err)
  await prisma.$disconnect()
  process.exit(1)
})
