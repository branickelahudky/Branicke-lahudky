// Seed - počáteční data pro Branické lahůdkářství
// Reálné kategorie a produkty převzaté z tvujreznik.cz
// Spuštění: npx prisma db seed

import { PrismaClient, Unit, StockStatus, PaymentProvider } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Mažu existující data...')
  // Pořadí důležité kvůli FK
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

  // ─── KATEGORIE ──────────────────────────────────────────────
  console.log('📁 Vytvářím kategorie...')

  const drubez = await prisma.category.create({
    data: { slug: 'drubez', name: 'Drůbeží maso', sortOrder: 1 },
  })
  await prisma.category.createMany({
    data: [
      { slug: 'kureci', name: 'Kuřecí maso', parentId: drubez.id, sortOrder: 1 },
      { slug: 'kruti', name: 'Krůtí maso', parentId: drubez.id, sortOrder: 2 },
      { slug: 'kachni', name: 'Kachní maso', parentId: drubez.id, sortOrder: 3 },
      { slug: 'husi', name: 'Husí maso', parentId: drubez.id, sortOrder: 4 },
      { slug: 'kralik', name: 'Králík', parentId: drubez.id, sortOrder: 5 },
    ],
  })

  const veprove = await prisma.category.create({
    data: { slug: 'veprove', name: 'Vepřové maso', sortOrder: 2 },
  })
  await prisma.category.create({
    data: { slug: 'seleci', name: 'Selečí maso', parentId: veprove.id },
  })

  const hovezi = await prisma.category.create({
    data: { slug: 'hovezi', name: 'Hovězí maso', sortOrder: 3 },
  })
  const hoveziSteak = await prisma.category.create({
    data: { slug: 'steak', name: 'Steak', parentId: hovezi.id, sortOrder: 4 },
  })
  await prisma.category.createMany({
    data: [
      { slug: 'teleci', name: 'Telecí maso', parentId: hovezi.id, sortOrder: 1 },
      { slug: 'krava', name: 'Kráva', parentId: hovezi.id, sortOrder: 2 },
      { slug: 'byk', name: 'Býk', parentId: hovezi.id, sortOrder: 3 },
    ],
  })

  const uzeniny = await prisma.category.create({
    data: { slug: 'uzeniny', name: 'Uzeniny', sortOrder: 4 },
  })
  const sunky = await prisma.category.create({
    data: { slug: 'sunky', name: 'Šunky', parentId: uzeniny.id, sortOrder: 1 },
  })
  const prsuty = await prisma.category.create({
    data: { slug: 'prsuty', name: 'Pršuty', parentId: uzeniny.id, sortOrder: 2 },
  })
  const sucheSalamy = await prisma.category.create({
    data: { slug: 'suche-salamy', name: 'Suché salámy', parentId: uzeniny.id, sortOrder: 3 },
  })
  await prisma.category.createMany({
    data: [
      { slug: 'klobasy', name: 'Klobásy', parentId: uzeniny.id, sortOrder: 4 },
      { slug: 'parky', name: 'Párky', parentId: uzeniny.id, sortOrder: 5 },
      { slug: 'jerky', name: 'Jerky', parentId: uzeniny.id, sortOrder: 6 },
    ],
  })

  // Speciální kategorie - vlajková loď
  const lahudky = await prisma.category.create({
    data: {
      slug: 'lahudky',
      name: 'Lahůdky a speciality',
      sortOrder: 5,
      description: 'Naše vlajková loď - originál NYC pastrami a další speciality.',
    },
  })

  const ryby = await prisma.category.create({
    data: { slug: 'ryby', name: 'Ryby', sortOrder: 6 },
  })

  // ─── PRODUKTY ───────────────────────────────────────────────
  console.log('🥩 Vytvářím produkty...')

  // Vlajková loď - NYC Pastrami
  await prisma.product.create({
    data: {
      sku: 'PASTRAMI-NYC',
      slug: 'originalni-nyc-pastrami',
      name: 'Originální NYC Pastrami',
      shortDescription: 'Naše vlajková loď. Hovězí hrudí, týden v koření, pomalu uzené.',
      description:
        'Originální newyorské pastrami podle receptury židovských deli z 20. let. Hovězí hrudí (brisket) z prvotřídního masa marinujeme týden v směsi koření, cukru a soli, poté pomalu udíme na bukovém dřevě a finalně dusíme do dokonalé křehkosti. Servírujte na žitném chlebu s hořčicí a kyselou okurkou.',
      priceWithoutVat: 535.71,
      priceWithVat: 600.0,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 15,
      categoryId: lahudky.id,
      isFeatured: true,
      ingredients:
        'Hovězí maso (hrudí), dusitanová solící směs (jedlá sůl, dusitan sodný), cukr, koření (pepř, koriandr, hořčice, česnek), kouř z bukového dřeva',
      allergens: 'Hořčice',
      origin: 'Česká republika',
      storageInfo: 'Uchovávat při teplotě 0-4 °C',
      shelfLifeDays: 14,
      publishedAt: new Date(),
    },
  })

  // Šunka od kosti Prantl
  const sunkaOdKosti = await prisma.product.create({
    data: {
      sku: '459',
      slug: 'sunka-od-kosti-prantl',
      name: 'Šunka od kosti - Prantl',
      shortDescription: 'Klasická šunka od kosti od osvědčeného výrobce.',
      priceWithoutVat: 40.41,
      priceWithVat: 48.9,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 20,
      categoryId: sunky.id,
      origin: 'Česká republika',
      storageInfo: 'Uchovávat při teplotě 0-4 °C',
      shelfLifeDays: 21,
      publishedAt: new Date(),
    },
  })

  await prisma.product.create({
    data: {
      sku: '462',
      slug: 'sunka-nejvyssi-jakosti-prantl',
      name: 'Šunka nejvyšší jakosti - Prantl',
      priceWithoutVat: 37.11,
      priceWithVat: 44.9,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 18,
      categoryId: sunky.id,
      publishedAt: new Date(),
    },
  })

  await prisma.product.create({
    data: {
      sku: '474',
      slug: 'prosciutto-crudo',
      name: 'Prosciutto Crudo',
      shortDescription: 'Italský sušený pršut.',
      priceWithoutVat: 49.5,
      priceWithVat: 59.9,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 12,
      categoryId: prsuty.id,
      origin: 'Itálie',
      publishedAt: new Date(),
    },
  })

  await prisma.product.create({
    data: {
      sku: '480',
      slug: 'schwarzwalder-schinken',
      name: 'Schwarzwälder Schinken',
      shortDescription: 'Německý uzený pršut ze Schwarzwaldu.',
      priceWithoutVat: 49.5,
      priceWithVat: 59.9,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 10,
      categoryId: prsuty.id,
      origin: 'Německo',
      publishedAt: new Date(),
    },
  })

  await prisma.product.create({
    data: {
      sku: '504',
      slug: 'madarsky-uherak-pick',
      name: 'Maďarský Uherák PICK',
      priceWithoutVat: 70.45,
      priceWithVat: 78.9,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.G_100,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 25,
      categoryId: sucheSalamy.id,
      origin: 'Maďarsko',
      publishedAt: new Date(),
    },
  })

  // Maso - vepřové
  await prisma.product.create({
    data: {
      sku: '141',
      slug: 'veprova-kyta',
      name: 'Vepřová kýta',
      priceWithoutVat: 84.82,
      priceWithVat: 95.0,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.KG,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 30,
      categoryId: veprove.id,
      origin: 'Česká republika',
      publishedAt: new Date(),
    },
  })

  // Hovězí svíčková
  await prisma.product.create({
    data: {
      sku: '84',
      slug: 'hovezi-svickova',
      name: 'Hovězí svíčková',
      priceWithoutVat: 794.64,
      priceWithVat: 890.0,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.KG,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 8,
      categoryId: hovezi.id,
      origin: 'Česká republika',
      publishedAt: new Date(),
    },
  })

  // Steak - Striploin s variantami
  const striploin = await prisma.product.create({
    data: {
      sku: '559',
      slug: 'striploin-steak',
      name: 'Striploin steak',
      shortDescription: 'Suché zrání 30 dní. Šťavnatý a křehký steak.',
      priceWithoutVat: 127.01,
      priceWithVat: 142.25,
      vatRate: 12.0,
      isWeightBased: false,
      unit: Unit.KS,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 15,
      categoryId: hoveziSteak.id,
      isNew: true,
      isFeatured: true,
      publishedAt: new Date(),
    },
  })

  await prisma.productVariant.createMany({
    data: [
      {
        productId: striploin.id,
        name: '250g',
        sku: '559/250',
        weightKg: 0.25,
        priceWithoutVat: 127.01,
        priceWithVat: 142.25,
        stockQuantity: 8,
        sortOrder: 1,
      },
      {
        productId: striploin.id,
        name: '500g',
        sku: '559/500',
        weightKg: 0.5,
        priceWithoutVat: 254.02,
        priceWithVat: 284.5,
        stockQuantity: 5,
        sortOrder: 2,
      },
    ],
  })

  // Husa - na dotaz
  await prisma.product.create({
    data: {
      sku: '201',
      slug: 'husa-cela-chlazena',
      name: 'Husa celá chlazená',
      shortDescription: 'Z lokální farmy. Sváteční pečení.',
      description:
        'Čerstvá chlazená husa z lokální farmy. Perfektní pro sváteční pečení - křehké maso plné chuti.',
      priceWithoutVat: 1174.64,
      priceWithVat: 1315.6,
      vatRate: 12.0,
      isWeightBased: true,
      unit: Unit.KG,
      stockStatus: StockStatus.OUT_OF_STOCK,
      stockQuantity: 0,
      categoryId: drubez.id,
      isOnSale: true,
      publishedAt: new Date(),
    },
  })

  // Kuřecí prsa s variantami
  const kureciPrsa = await prisma.product.create({
    data: {
      sku: '51',
      slug: 'kureci-prsa',
      name: 'Kuřecí prsa',
      priceWithoutVat: 88.39,
      priceWithVat: 99.0,
      vatRate: 12.0,
      isWeightBased: false,
      unit: Unit.KS,
      stockStatus: StockStatus.IN_STOCK,
      stockQuantity: 40,
      categoryId: drubez.id,
      publishedAt: new Date(),
    },
  })

  await prisma.productVariant.createMany({
    data: [
      {
        productId: kureciPrsa.id,
        name: '500g',
        sku: '51/500',
        weightKg: 0.5,
        priceWithoutVat: 88.39,
        priceWithVat: 99.0,
        stockQuantity: 20,
      },
      {
        productId: kureciPrsa.id,
        name: '1kg',
        sku: '51/1000',
        weightKg: 1.0,
        priceWithoutVat: 176.78,
        priceWithVat: 198.0,
        stockQuantity: 15,
      },
    ],
  })

  // ─── DOPRAVA ────────────────────────────────────────────────
  console.log('🚚 Vytvářím způsoby dopravy...')

  const dopravaPraha = await prisma.shippingMethod.create({
    data: {
      code: 'PRAHA_NEXT_DAY',
      name: 'Doručení po Praze - do druhého dne',
      description: 'Doručíme na jakékoliv místo v Praze. Chladící obal v ceně.',
      priceWithoutVat: 123.97,
      priceWithVat: 150.0,
      vatRate: 21.0,
      freeShippingThreshold: 1500.0,
      estimatedDaysMin: 1,
      estimatedDaysMax: 1,
      sortOrder: 1,
    },
  })

  const osobniOdber = await prisma.shippingMethod.create({
    data: {
      code: 'PICKUP_BRANIK',
      name: 'Osobní odběr - Branická 75',
      description: 'Vyzvedněte si objednávku přímo v našem obchodě v Braníku.',
      priceWithoutVat: 0,
      priceWithVat: 0,
      vatRate: 21.0,
      estimatedDaysMin: 0,
      estimatedDaysMax: 1,
      sortOrder: 2,
    },
  })

  const ppl = await prisma.shippingMethod.create({
    data: {
      code: 'PPL_CHLAZENA',
      name: 'PPL - chlazená přeprava',
      description: 'Pro objednávky mimo Prahu. Doručení druhý pracovní den.',
      priceWithoutVat: 206.61,
      priceWithVat: 250.0,
      vatRate: 21.0,
      freeShippingThreshold: 3000.0,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      maxWeightKg: 30.0,
      sortOrder: 3,
    },
  })

  // ─── PLATBY ─────────────────────────────────────────────────
  console.log('💳 Vytvářím platební metody...')

  const platbaKartou = await prisma.paymentMethod.create({
    data: {
      code: 'CARD_ONLINE',
      name: 'Platba kartou online',
      description: 'Visa, Mastercard, Apple Pay, Google Pay',
      provider: PaymentProvider.COMGATE,
      sortOrder: 1,
    },
  })

  const prevod = await prisma.paymentMethod.create({
    data: {
      code: 'BANK_TRANSFER',
      name: 'Bankovní převod',
      description: 'Objednávku vyřídíme po připsání platby.',
      provider: PaymentProvider.MANUAL,
      sortOrder: 2,
    },
  })

  const dobirka = await prisma.paymentMethod.create({
    data: {
      code: 'COD',
      name: 'Dobírka',
      description: 'Platba při převzetí - hotově nebo kartou.',
      feeWithoutVat: 24.79,
      feeWithVat: 30.0,
      vatRate: 21.0,
      provider: PaymentProvider.MANUAL,
      sortOrder: 3,
    },
  })

  const hotove = await prisma.paymentMethod.create({
    data: {
      code: 'CASH_ON_PICKUP',
      name: 'Hotově při vyzvednutí',
      description: 'Pouze pro osobní odběr.',
      provider: PaymentProvider.MANUAL,
      sortOrder: 4,
    },
  })

  // Kombinace doprava x platba
  await prisma.paymentMethodOnShipping.createMany({
    data: [
      // Doručení po Praze - karta, převod, dobírka
      { shippingMethodId: dopravaPraha.id, paymentMethodId: platbaKartou.id },
      { shippingMethodId: dopravaPraha.id, paymentMethodId: prevod.id },
      { shippingMethodId: dopravaPraha.id, paymentMethodId: dobirka.id },
      // Osobní odběr - karta, převod, hotově
      { shippingMethodId: osobniOdber.id, paymentMethodId: platbaKartou.id },
      { shippingMethodId: osobniOdber.id, paymentMethodId: prevod.id },
      { shippingMethodId: osobniOdber.id, paymentMethodId: hotove.id },
      // PPL - karta, převod, dobírka
      { shippingMethodId: ppl.id, paymentMethodId: platbaKartou.id },
      { shippingMethodId: ppl.id, paymentMethodId: prevod.id },
      { shippingMethodId: ppl.id, paymentMethodId: dobirka.id },
    ],
  })

  // ─── ADMIN ──────────────────────────────────────────────────
  console.log('👤 Vytvářím admin účet...')

  await prisma.adminUser.create({
    data: {
      email: 'admin@branickelahudky.cz',
      passwordHash: await bcrypt.hash('zmente-toto-heslo', 12),
      firstName: 'Lubomír',
      lastName: 'Markes',
      role: 'OWNER',
    },
  })

  // ─── TESTOVACÍ ZÁKAZNÍK ─────────────────────────────────────
  await prisma.customer.create({
    data: {
      email: 'test@example.cz',
      passwordHash: await bcrypt.hash('test1234', 12),
      firstName: 'Jan',
      lastName: 'Novák',
      phone: '+420777111222',
      addresses: {
        create: {
          type: 'BOTH',
          isDefault: true,
          firstName: 'Jan',
          lastName: 'Novák',
          street: 'Vinohradská 1',
          city: 'Praha 2',
          postalCode: '12000',
          country: 'CZ',
          phone: '+420777111222',
        },
      },
    },
  })

  // ─── SYSTÉMOVÉ STRÁNKY (idempotentní) ───────────────────────────
  const systemPages = [
    { slug: 'obchodni-podminky',    title: 'Obchodní podmínky',       sortOrder: 1 },
    { slug: 'ochrana-osobnich-udaju', title: 'Ochrana osobních údajů', sortOrder: 2 },
    { slug: 'reklamacni-rad',       title: 'Reklamační řád',           sortOrder: 3 },
    { slug: 'kontakt',              title: 'Kontakt',                  sortOrder: 4 },
    { slug: 'o-nas',                title: 'O nás',                    sortOrder: 5 },
  ]

  for (const page of systemPages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: { ...page, isSystem: true, isPublished: false },
      update: {}, // nikdy nepřepisuj existující obsah
    })
  }
  console.log(`  ✔ Systémové stránky (${systemPages.length})`)

  console.log('✅ Seed dokončen.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
