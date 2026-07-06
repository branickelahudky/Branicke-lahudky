// Seed - počáteční data pro Branické lahůdkářství
// Bezpečný / idempotentní: create → upsert, mazání jen s SEED_RESET=true
// Spuštění: npx prisma db seed
// Reset:    SEED_RESET=true npx prisma db seed

import { PrismaClient, Unit, StockStatus, PaymentProvider } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ─── DESTRUCTIVE RESET (opt-in) ─────────────────────────────────
  if (process.env.SEED_RESET === 'true') {
    console.warn('⚠️  SEED_RESET=true → MAŽU VŠECHNA DATA!')
    console.warn('   Máš 5 sekund na Ctrl+C, pokud to nechceš...')
    await new Promise((r) => setTimeout(r, 5000))

    await prisma.cartItem.deleteMany()
    await prisma.cart.deleteMany()
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.review.deleteMany()
    await prisma.productImage.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await prisma.address.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.paymentMethodOnShipping.deleteMany()
    await prisma.shippingMethod.deleteMany()
    await prisma.paymentMethod.deleteMany()
    await prisma.discountCode.deleteMany()
    await prisma.adminUser.deleteMany()

    console.log('🗑️  Data smazána, pokračuji s čerstvým seedem.')
  } else {
    console.log('ℹ️  Idempotentní mode — existující data NEMAŽU.')
    console.log('   Pro plný reset: SEED_RESET=true npx prisma db seed')
  }

  // ─── KATEGORIE ──────────────────────────────────────────────────
  console.log('📁 Kategorie...')

  const drubez = await prisma.category.upsert({
    where: { slug: 'drubez' },
    create: { slug: 'drubez', name: 'Drůbeží maso', sortOrder: 1 },
    update: {},
  })
  for (const d of [
    { slug: 'kureci',  name: 'Kuřecí maso',  parentId: drubez.id, sortOrder: 1 },
    { slug: 'kruti',   name: 'Krůtí maso',   parentId: drubez.id, sortOrder: 2 },
    { slug: 'kachni',  name: 'Kachní maso',  parentId: drubez.id, sortOrder: 3 },
    { slug: 'husi',    name: 'Husí maso',    parentId: drubez.id, sortOrder: 4 },
    { slug: 'kralik',  name: 'Králík',       parentId: drubez.id, sortOrder: 5 },
  ]) {
    await prisma.category.upsert({ where: { slug: d.slug }, create: d, update: {} })
  }

  const veprove = await prisma.category.upsert({
    where: { slug: 'veprove' },
    create: { slug: 'veprove', name: 'Vepřové maso', sortOrder: 2 },
    update: {},
  })
  await prisma.category.upsert({
    where: { slug: 'seleci' },
    create: { slug: 'seleci', name: 'Selečí maso', parentId: veprove.id },
    update: {},
  })

  const hovezi = await prisma.category.upsert({
    where: { slug: 'hovezi' },
    create: { slug: 'hovezi', name: 'Hovězí maso', sortOrder: 3 },
    update: {},
  })
  const hoveziSteak = await prisma.category.upsert({
    where: { slug: 'steak' },
    create: { slug: 'steak', name: 'Steak', parentId: hovezi.id, sortOrder: 4 },
    update: {},
  })
  for (const d of [
    { slug: 'teleci', name: 'Telecí maso', parentId: hovezi.id, sortOrder: 1 },
    { slug: 'krava',  name: 'Kráva',       parentId: hovezi.id, sortOrder: 2 },
    { slug: 'byk',    name: 'Býk',         parentId: hovezi.id, sortOrder: 3 },
  ]) {
    await prisma.category.upsert({ where: { slug: d.slug }, create: d, update: {} })
  }

  const uzeniny = await prisma.category.upsert({
    where: { slug: 'uzeniny' },
    create: { slug: 'uzeniny', name: 'Uzeniny', sortOrder: 4 },
    update: {},
  })
  const sunky = await prisma.category.upsert({
    where: { slug: 'sunky' },
    create: { slug: 'sunky', name: 'Šunky', parentId: uzeniny.id, sortOrder: 1 },
    update: {},
  })
  const prsuty = await prisma.category.upsert({
    where: { slug: 'prsuty' },
    create: { slug: 'prsuty', name: 'Pršuty', parentId: uzeniny.id, sortOrder: 2 },
    update: {},
  })
  const sucheSalamy = await prisma.category.upsert({
    where: { slug: 'suche-salamy' },
    create: { slug: 'suche-salamy', name: 'Suché salámy', parentId: uzeniny.id, sortOrder: 3 },
    update: {},
  })
  for (const d of [
    { slug: 'klobasy', name: 'Klobásy', parentId: uzeniny.id, sortOrder: 4 },
    { slug: 'parky',   name: 'Párky',   parentId: uzeniny.id, sortOrder: 5 },
    { slug: 'jerky',   name: 'Jerky',   parentId: uzeniny.id, sortOrder: 6 },
  ]) {
    await prisma.category.upsert({ where: { slug: d.slug }, create: d, update: {} })
  }

  const lahudky = await prisma.category.upsert({
    where: { slug: 'lahudky' },
    create: { slug: 'lahudky', name: 'Lahůdky a speciality', sortOrder: 5,
              description: 'Naše vlajková loď - originál NYC pastrami a další speciality.' },
    update: {},
  })

  await prisma.category.upsert({
    where: { slug: 'ryby' },
    create: { slug: 'ryby', name: 'Ryby', sortOrder: 6 },
    update: {},
  })

  // ─── PRODUKTY ───────────────────────────────────────────────────
  console.log('🥩 Produkty...')

  await prisma.product.upsert({
    where: { sku: 'PASTRAMI-NYC' },
    create: {
      sku: 'PASTRAMI-NYC', slug: 'originalni-nyc-pastrami', name: 'Originální NYC Pastrami',
      shortDescription: 'Naše vlajková loď. Hovězí hrudí, týden v koření, pomalu uzené.',
      description: 'Originální newyorské pastrami podle receptury židovských deli z 20. let.',
      priceWithoutVat: 535.71, priceWithVat: 600.0, vatRate: 12.0,
      isWeightBased: true, unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 15,
      categoryId: lahudky.id, isFeatured: true,
      ingredients: 'Hovězí maso (hrudí), dusitanová solící směs, cukr, koření, kouř z bukového dřeva',
      allergens: 'Hořčice', origin: 'Česká republika', storageInfo: 'Uchovávat při 0-4 °C',
      shelfLifeDays: 14, publishedAt: new Date(),
    },
    update: {},
  })

  await prisma.product.upsert({
    where: { sku: '459' },
    create: {
      sku: '459', slug: 'sunka-od-kosti-prantl', name: 'Šunka od kosti - Prantl',
      shortDescription: 'Klasická šunka od kosti od osvědčeného výrobce.',
      priceWithoutVat: 40.41, priceWithVat: 48.9, vatRate: 12.0,
      isWeightBased: true, unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 20,
      categoryId: sunky.id, origin: 'Česká republika',
      storageInfo: 'Uchovávat při 0-4 °C', shelfLifeDays: 21, publishedAt: new Date(),
    },
    update: {},
  })

  await prisma.product.upsert({
    where: { sku: '462' },
    create: {
      sku: '462', slug: 'sunka-nejvyssi-jakosti-prantl', name: 'Šunka nejvyšší jakosti - Prantl',
      priceWithoutVat: 37.11, priceWithVat: 44.9, vatRate: 12.0,
      isWeightBased: true, unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 18,
      categoryId: sunky.id, publishedAt: new Date(),
    },
    update: {},
  })

  await prisma.product.upsert({
    where: { sku: '474' },
    create: {
      sku: '474', slug: 'prosciutto-crudo', name: 'Prosciutto Crudo',
      shortDescription: 'Italský sušený pršut.',
      priceWithoutVat: 49.5, priceWithVat: 59.9, vatRate: 12.0,
      isWeightBased: true, unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 12,
      categoryId: prsuty.id, origin: 'Itálie', publishedAt: new Date(),
    },
    update: {},
  })

  await prisma.product.upsert({
    where: { sku: '480' },
    create: {
      sku: '480', slug: 'schwarzwalder-schinken', name: 'Schwarzwälder Schinken',
      shortDescription: 'Německý uzený pršut ze Schwarzwaldu.',
      priceWithoutVat: 49.5, priceWithVat: 59.9, vatRate: 12.0,
      isWeightBased: true, unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 10,
      categoryId: prsuty.id, origin: 'Německo', publishedAt: new Date(),
    },
    update: {},
  })

  await prisma.product.upsert({
    where: { sku: '504' },
    create: {
      sku: '504', slug: 'madarsky-uherak-pick', name: 'Maďarský Uherák PICK',
      priceWithoutVat: 70.45, priceWithVat: 78.9, vatRate: 12.0,
      isWeightBased: true, unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 25,
      categoryId: sucheSalamy.id, origin: 'Maďarsko', publishedAt: new Date(),
    },
    update: {},
  })

  await prisma.product.upsert({
    where: { sku: '141' },
    create: {
      sku: '141', slug: 'veprova-kyta', name: 'Vepřová kýta',
      priceWithoutVat: 84.82, priceWithVat: 95.0, vatRate: 12.0,
      isWeightBased: true, unit: Unit.KG,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 30,
      categoryId: veprove.id, origin: 'Česká republika', publishedAt: new Date(),
    },
    update: {},
  })

  await prisma.product.upsert({
    where: { sku: '84' },
    create: {
      sku: '84', slug: 'hovezi-svickova', name: 'Hovězí svíčková',
      priceWithoutVat: 794.64, priceWithVat: 890.0, vatRate: 12.0,
      isWeightBased: true, unit: Unit.KG,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 8,
      categoryId: hovezi.id, origin: 'Česká republika', publishedAt: new Date(),
    },
    update: {},
  })

  const striploin = await prisma.product.upsert({
    where: { sku: '559' },
    create: {
      sku: '559', slug: 'striploin-steak', name: 'Striploin steak',
      shortDescription: 'Suché zrání 30 dní. Šťavnatý a křehký steak.',
      priceWithoutVat: 127.01, priceWithVat: 142.25, vatRate: 12.0,
      isWeightBased: false, unit: Unit.KS,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 15,
      categoryId: hoveziSteak.id, isNew: true, isFeatured: true, publishedAt: new Date(),
    },
    update: {},
  })

  for (const v of [
    { sku: '559/250', name: '250g', weightKg: 0.25, priceWithoutVat: 127.01, priceWithVat: 142.25, stockQuantity: 8,  sortOrder: 1 },
    { sku: '559/500', name: '500g', weightKg: 0.5,  priceWithoutVat: 254.02, priceWithVat: 284.5,  stockQuantity: 5,  sortOrder: 2 },
  ]) {
    await prisma.productVariant.upsert({
      where: { sku: v.sku },
      create: { ...v, productId: striploin.id },
      update: {},
    })
  }

  await prisma.product.upsert({
    where: { sku: '201' },
    create: {
      sku: '201', slug: 'husa-cela-chlazena', name: 'Husa celá chlazená',
      shortDescription: 'Z lokální farmy. Sváteční pečení.',
      description: 'Čerstvá chlazená husa z lokální farmy.',
      priceWithoutVat: 1174.64, priceWithVat: 1315.6, vatRate: 12.0,
      isWeightBased: true, unit: Unit.KG,
      stockStatus: StockStatus.OUT_OF_STOCK, stockQuantity: 0,
      categoryId: drubez.id, isOnSale: true, publishedAt: new Date(),
    },
    update: {},
  })

  const kureciPrsa = await prisma.product.upsert({
    where: { sku: '51' },
    create: {
      sku: '51', slug: 'kureci-prsa', name: 'Kuřecí prsa',
      priceWithoutVat: 88.39, priceWithVat: 99.0, vatRate: 12.0,
      isWeightBased: false, unit: Unit.KS,
      stockStatus: StockStatus.IN_STOCK, stockQuantity: 40,
      categoryId: drubez.id, publishedAt: new Date(),
    },
    update: {},
  })

  for (const v of [
    { sku: '51/500',  name: '500g', weightKg: 0.5, priceWithoutVat: 88.39,  priceWithVat: 99.0,  stockQuantity: 20, sortOrder: 1 },
    { sku: '51/1000', name: '1kg',  weightKg: 1.0, priceWithoutVat: 176.78, priceWithVat: 198.0, stockQuantity: 15, sortOrder: 2 },
  ]) {
    await prisma.productVariant.upsert({
      where: { sku: v.sku },
      create: { ...v, productId: kureciPrsa.id },
      update: {},
    })
  }

  // ─── DOPRAVA ────────────────────────────────────────────────────
  console.log('🚚 Doprava...')

  const osobniOdber = await prisma.shippingMethod.upsert({
    where: { code: 'PICKUP_BRANIK' },
    create: {
      code: 'PICKUP_BRANIK', name: 'Osobní odběr - Branická 75',
      description: 'Vyzvedněte si objednávku přímo v našem obchodě v Braníku.',
      priceWithoutVat: 0, priceWithVat: 0, vatRate: 21.0,
      estimatedDaysMin: 0, estimatedDaysMax: 1, sortOrder: 1,
      availableCountries: ['CZ', 'SK'],
    },
    update: {},
  })

  // Cool Balík — ceník podle váhy. Zóna 1 (Praha) a 2 (ČR) mají stejné ceny
  // → jeden ceník ČR; zóna 3 (Slovensko) má vlastní dražší ceny (v Kč).
  const COOL_TIERS_CZ = [
    { maxWeightKg: 5,  priceWithVat: 190 },
    { maxWeightKg: 10, priceWithVat: 190 },
    { maxWeightKg: 15, priceWithVat: 230 },
    { maxWeightKg: 20, priceWithVat: 270 },
    { maxWeightKg: 30, priceWithVat: 350 },
    { maxWeightKg: 40, priceWithVat: 430 },
    { maxWeightKg: 50, priceWithVat: 510 },
  ]
  const COOL_TIERS_SK = [
    { maxWeightKg: 5,  priceWithVat: 220 },
    { maxWeightKg: 10, priceWithVat: 220 },
    { maxWeightKg: 15, priceWithVat: 260 },
    { maxWeightKg: 20, priceWithVat: 300 },
    { maxWeightKg: 30, priceWithVat: 380 },
    { maxWeightKg: 40, priceWithVat: 460 },
    { maxWeightKg: 50, priceWithVat: 540 },
  ]

  async function upsertCoolBalik(
    code: string, name: string, country: string,
    tiers: { maxWeightKg: number; priceWithVat: number }[], sortOrder: number,
  ) {
    const method = await prisma.shippingMethod.upsert({
      where: { code },
      create: {
        code, name,
        description: 'Chlazená přeprava až domů. Doručení druhý pracovní den.',
        priceWithoutVat: 157.02, priceWithVat: 190.0, vatRate: 21.0,
        freeShippingThreshold: 3000.0,
        usesWeightTiers: true, maxWeightKg: 50.0, defaultItemWeightGrams: 1000,
        estimatedDaysMin: 1, estimatedDaysMax: 2, sortOrder,
        availableCountries: [country],
      },
      update: {},
    })
    await prisma.shippingWeightTier.deleteMany({ where: { shippingMethodId: method.id } })
    await prisma.shippingWeightTier.createMany({
      data: tiers.map((t, i) => ({ ...t, shippingMethodId: method.id, sortOrder: i })),
    })
    return method
  }

  const coolBalikCz = await upsertCoolBalik(
    'COOL_BALIK_CZ', 'Cool Balík — chlazená přeprava (ČR)', 'CZ', COOL_TIERS_CZ, 2,
  )
  const coolBalikSk = await upsertCoolBalik(
    'COOL_BALIK_SK', 'Cool Balík — chlazená přeprava (Slovensko)', 'SK', COOL_TIERS_SK, 3,
  )

  // ─── PLATBY ─────────────────────────────────────────────────────
  console.log('💳 Platby...')

  const platbaKartou = await prisma.paymentMethod.upsert({
    where: { code: 'CARD_ONLINE' },
    create: {
      code: 'CARD_ONLINE', name: 'Platba kartou online',
      description: 'Visa, Mastercard, Apple Pay, Google Pay',
      provider: PaymentProvider.COMGATE, sortOrder: 1,
    },
    update: {},
  })

  const prevod = await prisma.paymentMethod.upsert({
    where: { code: 'BANK_TRANSFER' },
    create: {
      code: 'BANK_TRANSFER', name: 'Bankovní převod',
      description: 'Objednávku vyřídíme po připsání platby.',
      provider: PaymentProvider.MANUAL, sortOrder: 2,
    },
    update: {},
  })

  const dobirka = await prisma.paymentMethod.upsert({
    where: { code: 'COD' },
    create: {
      code: 'COD', name: 'Dobírka',
      description: 'Platba při převzetí - hotově nebo kartou.',
      feeWithoutVat: 24.79, feeWithVat: 30.0, vatRate: 21.0,
      provider: PaymentProvider.MANUAL, sortOrder: 3,
    },
    update: {},
  })

  const hotove = await prisma.paymentMethod.upsert({
    where: { code: 'CASH_ON_PICKUP' },
    create: {
      code: 'CASH_ON_PICKUP', name: 'Hotově při vyzvednutí',
      description: 'Pouze pro osobní odběr.',
      provider: PaymentProvider.MANUAL, sortOrder: 4,
    },
    update: {},
  })

  // PayPal — v pokladně se nabízí jen s nastavenými env klíči (PAYPAL_CLIENT_ID/SECRET).
  // Poplatek 0 — případnou přirážku na pokrytí PayPal poplatků (~3,4 %) nastaví admin.
  const paypal = await prisma.paymentMethod.upsert({
    where: { code: 'PAYPAL' },
    create: {
      code: 'PAYPAL', name: 'PayPal',
      description: 'Zaplatíte online přes PayPal účet nebo kartou.',
      provider: PaymentProvider.PAYPAL, type: 'card', sortOrder: 5,
    },
    update: {},
  })

  // Kombinace doprava × platba
  for (const pair of [
    { shippingMethodId: osobniOdber.id,  paymentMethodId: platbaKartou.id },
    { shippingMethodId: osobniOdber.id,  paymentMethodId: prevod.id },
    { shippingMethodId: osobniOdber.id,  paymentMethodId: hotove.id },
    { shippingMethodId: coolBalikCz.id,  paymentMethodId: platbaKartou.id },
    { shippingMethodId: coolBalikCz.id,  paymentMethodId: prevod.id },
    { shippingMethodId: coolBalikCz.id,  paymentMethodId: dobirka.id },
    { shippingMethodId: coolBalikSk.id,  paymentMethodId: platbaKartou.id },
    { shippingMethodId: coolBalikSk.id,  paymentMethodId: prevod.id },
    { shippingMethodId: coolBalikSk.id,  paymentMethodId: dobirka.id },
    { shippingMethodId: osobniOdber.id,  paymentMethodId: paypal.id },
    { shippingMethodId: coolBalikCz.id,  paymentMethodId: paypal.id },
    { shippingMethodId: coolBalikSk.id,  paymentMethodId: paypal.id },
  ]) {
    await prisma.paymentMethodOnShipping.upsert({
      where: { shippingMethodId_paymentMethodId: pair },
      create: pair,
      update: {},
    })
  }

  // ─── ADMIN ÚČET ─────────────────────────────────────────────────
  console.log('👤 Admin...')

  await prisma.adminUser.upsert({
    where: { email: 'admin@branickelahudky.cz' },
    create: {
      email: 'admin@branickelahudky.cz',
      passwordHash: await bcrypt.hash('zmente-toto-heslo', 12),
      firstName: 'Lubomír', lastName: 'Markes', role: 'OWNER',
    },
    update: {},
  })

  // ─── TESTOVACÍ ZÁKAZNÍK ─────────────────────────────────────────
  const testCustomer = await prisma.customer.upsert({
    where: { email: 'test@example.cz' },
    create: {
      email: 'test@example.cz',
      passwordHash: await bcrypt.hash('test1234', 12),
      firstName: 'Jan', lastName: 'Novák', phone: '+420777111222',
    },
    update: {},
  })
  // Adresa zákazníka (jen pokud ještě nemá)
  const addrCount = await prisma.address.count({ where: { customerId: testCustomer.id } })
  if (addrCount === 0) {
    await prisma.address.create({
      data: {
        customerId: testCustomer.id, type: 'BOTH', isDefault: true,
        firstName: 'Jan', lastName: 'Novák', street: 'Vinohradská 1',
        city: 'Praha 2', postalCode: '12000', country: 'CZ', phone: '+420777111222',
      },
    })
  }

  // ─── HOMEPAGE SEKCE (pevná sada, doporučené pořadí F9) ────────────────
  // Pořadí (sortOrder) se vynucuje i při update — záměr sprintu F9 je
  // srovnat homepage na doporučené rozložení. Viditelnost se nastaví jen
  // při vytvoření (re-seed nepřepíše ruční zapnutí/vypnutí v adminu).
  const homepageDefs: Array<{ type: 'CAROUSEL' | 'USP_BAR' | 'FEATURED_CATEGORIES' | 'ABOUT_TEXT' | 'PROMO_TILES' | 'MID_BANNER' | 'FOOTER_CARDS' | 'SHELF_SALE' | 'SHELF_NEW' | 'SHELF_FEATURED'; sortOrder: number; isVisible: boolean; config?: object }> = [
    { type: 'CAROUSEL',            sortOrder: 0, isVisible: true  },
    { type: 'USP_BAR',             sortOrder: 1, isVisible: true  }, // lišta důvěry hned pod carouselem (F21)
    { type: 'PROMO_TILES',         sortOrder: 2, isVisible: true  },
    { type: 'FEATURED_CATEGORIES', sortOrder: 3, isVisible: true,  config: { categoryIds: [] } },
    { type: 'SHELF_SALE',          sortOrder: 4, isVisible: true  },
    { type: 'SHELF_NEW',           sortOrder: 5, isVisible: true  },
    { type: 'MID_BANNER',          sortOrder: 6, isVisible: true  },
    { type: 'SHELF_FEATURED',      sortOrder: 7, isVisible: true  },
    { type: 'ABOUT_TEXT',          sortOrder: 8, isVisible: false, config: { text: '' } },
    { type: 'FOOTER_CARDS',        sortOrder: 9, isVisible: true  },
  ]
  for (const def of homepageDefs) {
    await prisma.homepageSection.upsert({
      where: { type: def.type },
      create: { type: def.type, sortOrder: def.sortOrder, isVisible: def.isVisible, ...(def.config ? { config: def.config } : {}) },
      update: { sortOrder: def.sortOrder },
    })
  }
  // FEATURED_PRODUCTS nahrazen dedikovaným SHELF_FEATURED — odstraníme
  await prisma.homepageSection.deleteMany({ where: { type: 'FEATURED_PRODUCTS' } })
  console.log(`  ✔ Homepage sekce (${homepageDefs.length})`)

  // ─── BENEFITY (USP) — jen když tabulka zeje prázdnotou (F21) ─────────
  const uspCount = await prisma.uspItem.count()
  if (uspCount === 0) {
    await prisma.uspItem.createMany({
      data: [
        { icon: 'snowflake', title: 'Chlazená přeprava',       subtitle: 'Čerstvé maso až k vám — ČR i Slovensko', sortOrder: 0 },
        { icon: 'truck',     title: 'Doprava zdarma',          subtitle: 'Při nákupu nad 3 000 Kč',                sortOrder: 1 },
        { icon: 'medal',     title: 'Rodinná tradice od 1992', subtitle: 'Vlastní výroba a poctivé lahůdky',       sortOrder: 2 },
      ],
    })
    console.log('  ✔ Benefity USP (3)')
  }

  // ─── COOKIES NASTAVENÍ (singleton) ────────────────────────────────────
  const cookiesExists = await prisma.cookieSettings.findFirst({ select: { id: true } })
  if (!cookiesExists) {
    await prisma.cookieSettings.create({
      data: {
        enabled: true,
        bannerTitle: 'Používáme cookies',
        bannerText:
          'Tento web používá cookies pro zajištění správné funkce a zlepšení vašeho zážitku. ' +
          'Kliknutím na „Přijmout vše" souhlasíte s jejich použitím. Více informací najdete v zásadách cookies.',
        acceptAllLabel: 'Přijmout vše',
        rejectLabel: 'Odmítnout',
      },
    })
    console.log('  ✔ CookieSettings singleton vytvořen')
  }

  // ─── IDENTITA WEBU (singleton) ─────────────────────────────────────
  const identityExists = await prisma.siteIdentity.findFirst({ select: { id: true } })
  if (!identityExists) {
    await prisma.siteIdentity.create({
      data: { footerCopyright: `© ${new Date().getFullYear()} Branické lahůdkářství` },
    })
    console.log('  ✔ SiteIdentity singleton vytvořen')
  }

  // ─── NAVIGAČNÍ MENU (idempotentní — vytvoří jen chybějící) ────────
  console.log('🔗 Menu...')

  // Načti stránky pro seed
  const pagesBySlug = Object.fromEntries(
    (await prisma.page.findMany({ select: { id: true, slug: true } }))
      .map((p) => [p.slug, p.id])
  )

  const seedMenuItems: Array<{
    location: 'HEADER' | 'FOOTER'
    label: string
    linkType: 'PAGE' | 'CATEGORY' | 'URL'
    pageSlug?: string
    url?: string
    sortOrder: number
  }> = [
    { location: 'HEADER', label: 'Domů',    linkType: 'URL', url: '/',                    sortOrder: 1 },
    { location: 'HEADER', label: 'Kontakt', linkType: 'PAGE', pageSlug: 'kontakt',         sortOrder: 2 },
    { location: 'FOOTER', label: 'Obchodní podmínky',      linkType: 'PAGE', pageSlug: 'obchodni-podminky',      sortOrder: 1 },
    { location: 'FOOTER', label: 'Ochrana osobních údajů', linkType: 'PAGE', pageSlug: 'ochrana-osobnich-udaju', sortOrder: 2 },
    { location: 'FOOTER', label: 'Reklamační řád',         linkType: 'PAGE', pageSlug: 'reklamacni-rad',         sortOrder: 3 },
    { location: 'FOOTER', label: 'O nás',                  linkType: 'PAGE', pageSlug: 'o-nas',                 sortOrder: 4 },
  ]

  for (const item of seedMenuItems) {
    const exists = await prisma.menuItem.findFirst({
      where: { location: item.location, label: item.label },
    })
    if (!exists) {
      const pageId = item.pageSlug ? (pagesBySlug[item.pageSlug] ?? null) : null
      await prisma.menuItem.create({
        data: {
          location: item.location,
          label: item.label,
          linkType: item.linkType,
          pageId,
          url: item.url ?? null,
          sortOrder: item.sortOrder,
        },
      })
    }
  }
  console.log('  ✔ Menu položky')

  // ─── SYSTÉMOVÉ STRÁNKY (vždy idempotentní) ──────────────────────
  const systemPages = [
    { slug: 'obchodni-podminky',      title: 'Obchodní podmínky',       sortOrder: 1 },
    { slug: 'ochrana-osobnich-udaju', title: 'Ochrana osobních údajů',   sortOrder: 2 },
    { slug: 'reklamacni-rad',         title: 'Reklamační řád',           sortOrder: 3 },
    { slug: 'kontakt',                title: 'Kontakt',                  sortOrder: 4 },
    { slug: 'o-nas',                  title: 'O nás',                    sortOrder: 5 },
    { slug: 'zasady-cookies',         title: 'Zásady používání cookies', sortOrder: 6 },
  ]
  for (const page of systemPages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: { ...page, isSystem: true, isPublished: false },
      update: {},
    })
  }
  console.log(`  ✔ Systémové stránky (${systemPages.length})`)

  console.log('✅ Seed dokončen.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
