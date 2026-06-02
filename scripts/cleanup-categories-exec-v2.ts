/**
 * OSTRÁ VERZE v2: Bezpečný úklid duplicitních seed kategorií.
 * ⚠️  ZAPISUJE DO DB — spouštěj pouze po odsouhlasení dry-run v2.
 * Použití: npx tsx --env-file=.env scripts/cleanup-categories-exec-v2.ts
 *
 * Plán (shodný s dry-run v2):
 *  1. Přesun SKU 243 + 240 → drubezi-maso
 *  2. Uzeniny + Lahůdky — již kořenové, žádná akce
 *  3. Smazání 19 prázdných seed kategorií (od listů k rodičům)
 *  4. Kontrola počtu produktů před/po — musí být stejný → jinak ROLLBACK
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_ROOT_SLUGS   = ['drubez', 'hovezi', 'veprove', 'uzeniny', 'lahudky', 'ryby']
const KEEP_SEED_SLUGS   = ['uzeniny', 'lahudky']
const DELETE_SEED_ROOTS = ['drubez', 'hovezi', 'veprove']

const CLEAR_MOVES: Array<{ sku: string; targetImportSlug: string }> = [
  { sku: '243', targetImportSlug: 'drubezi-maso' },
  { sku: '240', targetImportSlug: 'drubezi-maso' },
]

type Cat = {
  id: string; name: string; slug: string
  parentId: string | null; productCount: number
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║   OSTRÝ ÚKLID v2: Bezpečný úklid duplicitních kategorií     ║')
  console.log('║   ⚠️  ZAPISUJE DO DB                                          ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log('║   ŽELEZNÉ PRAVIDLO: Maže se POUZE kategorie, na které       ║')
  console.log('║   (ani v jejím podstromu) nevisí ani jeden produkt.         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // ── 0. Načti stav + baseline count ────────────────────────────────

  const countBefore = await prisma.product.count()
  console.log(`  Produktů v DB před úklidem: ${countBefore}`)
  console.log()

  const rawCats = await prisma.category.findMany({
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, slug: true, parentId: true,
      _count: { select: { products: true } },
    },
  })
  const cats: Cat[] = rawCats.map(c => ({
    id: c.id, name: c.name, slug: c.slug, parentId: c.parentId,
    productCount: c._count.products,
  }))

  const byId   = new Map(cats.map(c => [c.id, c]))
  const bySlug = new Map(cats.map(c => [c.slug, c]))

  function descendants(catId: string): Cat[] {
    const children = cats.filter(c => c.parentId === catId)
    return [...children, ...children.flatMap(c => descendants(c.id))]
  }

  function subtreeProductCount(cat: Cat): number {
    return cat.productCount + descendants(cat.id).reduce((s, c) => s + c.productCount, 0)
  }

  // ── 1. Identifikace přesunů ─────────────────────────────────────

  const moves: Array<{ productId: string; productName: string; sku: string; targetCatId: string; targetCatName: string }> = []

  for (const move of CLEAR_MOVES) {
    const product = await prisma.product.findFirst({
      where: { sku: move.sku },
      select: { id: true, name: true, sku: true },
    })
    const targetCat = bySlug.get(move.targetImportSlug)

    if (!product) throw new Error(`Produkt SKU "${move.sku}" NENALEZEN`)
    if (!targetCat) throw new Error(`Cílová kategorie "${move.targetImportSlug}" NENALEZENA`)

    moves.push({ productId: product.id, productName: product.name, sku: product.sku,
                 targetCatId: targetCat.id, targetCatName: targetCat.name })
  }

  // ── 2. Identifikace kategorií ke smazání ────────────────────────

  const seedCandidates: Cat[] = []
  for (const rootSlug of DELETE_SEED_ROOTS) {
    const root = bySlug.get(rootSlug)
    if (!root) continue
    seedCandidates.push(root, ...descendants(root.id))
  }
  // Podkategorie KEEP kořenů (krátké slugy = seed)
  for (const slug of KEEP_SEED_SLUGS) {
    const cat = bySlug.get(slug)
    if (!cat) continue
    const seedChildren = descendants(cat.id).filter(c =>
      !c.slug.startsWith(cat.slug + '-')
    )
    seedCandidates.push(...seedChildren)
  }

  const candidateMap = new Map(seedCandidates.map(c => [c.id, c]))

  // Přesunuté produkty — po přesunu jejich původní kategorie bude prázdná
  const movedProductIds = new Set(moves.map(m => m.productId))

  async function productsAfterMove(catId: string): Promise<number> {
    const prods = await prisma.product.findMany({
      where: { categoryId: catId },
      select: { id: true },
    })
    return prods.filter(p => !movedProductIds.has(p.id)).length
  }

  // Seřadit: děti (s parentId) dřív než rodiče → správné pořadí mazání
  const ordered = [...candidateMap.values()].sort((a, b) => {
    const aDepth = a.parentId ? 1 : 0
    const bDepth = b.parentId ? 1 : 0
    return bDepth - aDepth
  })

  const toDelete: Cat[] = []

  for (const cat of ordered) {
    if (KEEP_SEED_SLUGS.includes(cat.slug)) continue

    const directAfter = await productsAfterMove(cat.id)
    const descCats    = descendants(cat.id)
    let descAfter     = 0
    for (const dc of descCats) {
      if (candidateMap.has(dc.id) && !KEEP_SEED_SLUGS.includes(dc.slug)) {
        descAfter += await productsAfterMove(dc.id)
      }
    }

    const totalAfter = directAfter + descAfter

    if (totalAfter > 0) {
      // Toto by dry-run zachytil — pokud se sem dostaneme, abort
      throw new Error(
        `BEZPEČNOSTNÍ ZASTÁVKA: Kategorie „${cat.name}" (${cat.slug}) by po přesunech` +
        ` stále držela ${totalAfter} produktů. Abort.`
      )
    }

    toDelete.push(cat)
  }

  // ── VÝPIS PLÁNU ────────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('PLÁN')
  console.log('════════════════════════════════════════════════════════════════\n')

  console.log(`  Přesuny produktů (${moves.length}):`)
  for (const m of moves) {
    console.log(`    • „${m.productName}" (SKU ${m.sku}) → ${m.targetCatName}`)
  }
  console.log()

  console.log(`  Mazání prázdných kategorií (${toDelete.length}):`)
  for (const c of toDelete) {
    console.log(`    • ${c.name} (${c.slug})`)
  }
  console.log()

  // ── TRANSAKCE ──────────────────────────────────────────────────

  console.log('════════════════════════════════════════════════════════════════')
  console.log('PROVÁDÍM…')
  console.log('════════════════════════════════════════════════════════════════\n')

  await prisma.$transaction(async (tx) => {
    // Kontrola počtu produktů na začátku transakce
    const countStart = await tx.product.count()
    console.log(`  [TXN] Produktů na vstupu transakce: ${countStart}`)

    // 1. Přesuny produktů
    let movedCount = 0
    for (const m of moves) {
      await tx.product.update({
        where: { id: m.productId },
        data: { categoryId: m.targetCatId },
      })
      console.log(`  ✓ Přesunuto: „${m.productName}" (SKU ${m.sku}) → ${m.targetCatName}`)
      movedCount++
    }

    // 2. Uzeniny + Lahůdky — ověř že jsou kořenové (žádná akce potřeba)
    for (const slug of KEEP_SEED_SLUGS) {
      const cat = bySlug.get(slug)
      if (!cat) throw new Error(`KEEP kategorie "${slug}" nenalezena`)
      if (cat.parentId !== null) {
        // Pokud by nebyla kořenová, povýšit
        await tx.category.update({ where: { id: cat.id }, data: { parentId: null } })
        console.log(`  ✓ Povýšeno na kořen: ${cat.name} (${slug})`)
      } else {
        console.log(`  ✓ Zachováno (již kořen): ${cat.name} (${slug})`)
      }
    }

    // 3. Smazání prázdných kategorií (od listů k rodičům)
    let deletedCount = 0
    for (const cat of toDelete) {
      // Dvojitá pojistka: zkontroluj přímo v transakci
      const liveCount = await tx.product.count({ where: { categoryId: cat.id } })
      if (liveCount > 0) {
        throw new Error(
          `ROLLBACK: Kategorie „${cat.name}" (${cat.slug}) v transakci stále drží` +
          ` ${liveCount} produktů!`
        )
      }
      await tx.category.delete({ where: { id: cat.id } })
      deletedCount++
    }
    console.log(`  ✓ Smazáno kategorií: ${deletedCount}`)

    // Kontrola počtu produktů na konci transakce — musí být stejný
    const countEnd = await tx.product.count()
    console.log(`  [TXN] Produktů na výstupu transakce: ${countEnd}`)

    if (countEnd !== countStart) {
      throw new Error(
        `ROLLBACK: Počet produktů se změnil! ${countStart} → ${countEnd}. Transakce zrušena.`
      )
    }

    console.log(`  ✓ Kontrola počtu produktů: ${countStart} = ${countEnd}  OK`)
  })

  // ── VÝSLEDKY ───────────────────────────────────────────────────

  const countAfter = await prisma.product.count()

  console.log()
  console.log('════════════════════════════════════════════════════════════════')
  console.log('VÝSLEDKY')
  console.log('════════════════════════════════════════════════════════════════\n')

  console.log(`  Produktů PŘED: ${countBefore}`)
  console.log(`  Produktů PO:   ${countAfter}`)
  console.log(`  Shoda:         ${countBefore === countAfter ? '✓ ANO' : '✗ NESEDÍ — zkontroluj!'}`)
  console.log()

  // Finální seznam kořenových kategorií
  const finalRoots = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, _count: { select: { products: true } } },
  })

  console.log('  Kořenové kategorie po úklidu:')
  for (const c of finalRoots) {
    const isSeed = SEED_ROOT_SLUGS.includes(c.slug)
    const isKept = KEEP_SEED_SLUGS.includes(c.slug)
    const tag    = isKept ? ' [SEED→zachován]' : isSeed ? ' [SEED]' : ' [IMPORT]'
    console.log(`    • ${c.name} (${c.slug}) — ${c._count.products} přímých produktů${tag}`)
  }

  console.log()
  if (countBefore === countAfter) {
    console.log('  ✅ Úklid dokončen úspěšně.')
  } else {
    console.log('  ❌ Počty nesedí — prověř DB!')
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('\nCHYBA / ROLLBACK:', err.message ?? err)
  await prisma.$disconnect()
  process.exit(1)
})
