# Branické lahůdkářství — vlastní e-shop

Náhrada Shoptetu (2 400 Kč/měsíc) postavená na **Next.js 15 + Prisma + PostgreSQL**.
Tenhle repozitář obsahuje základní kostru. Dál se z toho dá stavět e-shop i admin
beze sklenů, a později i mobilní aplikace přes stejné API.

## Co je hotové

- **Prisma schéma** pokrývající celé doménové modely (produkty, kategorie,
  objednávky, zákazníci, doprava, platby, košík, slevy, recenze, admin)
- **Cenové helpery** se správným zaokrouhlováním Kč, DPH 12 % na potraviny
  a výpočtem váhových produktů (cena dle skutečné navážené váhy)
- **REST API** — `/api/products`, `/api/orders`, `/api/categories`,
  `/api/shipping-methods`, `/api/payment-methods`
- **Admin dashboard** ve stylu Shoptetu (přehled, statistiky, nedávné objednávky)
- **Veřejná homepage** s vlajkovou lodí (NYC pastrami)
- **Seed** s reálnými produkty z dnešního tvujreznik.cz

## Specifika lahůdkářství

Tohle není běžný e-shop. Schéma je navržené s ohledem na následující reality:

1. **Váhové produkty.** Zákazník objedná „250 g pastrami" a cena se přepočítá až
   podle skutečné navážené váhy (např. 247 g). `OrderItem` má proto pole
   `expectedWeightKg` (co zákazník chtěl) a `actualWeightKg` (co obsluha navážila).

2. **DPH 12 % na potraviny.** V CZ od 2024 platí 12 % na potraviny a 21 % na
   dopravu/platební poplatky. Default je v každém modelu nastavený správně.

3. **Termín doručení.** Lahůdky obvykle nemají skladovou výdrž 14 dnů — objednávka
   nese `preferredDeliveryDate` a `deliveryTimeSlot` (např. „čtvrtek 12-18").

4. **B2B.** Restaurace nakupují s IČO/DIČ. `Order` má vlastní pole pro firemní
   údaje (lze fakturovat na firmu i pro nepřihlášeného B2B zákazníka).

5. **Snapshot v objednávce.** Ceny a adresy se v čase mění. Každá `OrderItem` má
   snapshot ceny v okamžiku objednání. Adresy se ukládají jako JSON i jako FK.

6. **Stavy skladu.** `IN_STOCK | LOW_STOCK | OUT_OF_STOCK | ON_REQUEST |
   TEMPORARILY_UNAVAILABLE` — řeznictví má často „na dotaz" (např. husa z farmy).

## Spuštění

```bash
# 1) instalace
npm install

# 2) konfigurace
cp .env.example .env
# vyplň DATABASE_URL (lokální PostgreSQL nebo Neon/Supabase)

# 3) databáze
npm run db:push      # vytvoří tabulky
npm run db:seed      # nahraje testovací data

# 4) spuštění
npm run dev
```

Otevři <http://localhost:3000> pro e-shop a <http://localhost:3000/admin> pro administraci.

### Doporučená PostgreSQL hosting řešení

- **Neon** (zdarma do 0,5 GB, CZ region pres EU-Frankfurt) — nejjednodušší start
- **Supabase** (zdarma do 500 MB, navíc auth a storage)
- **Railway** / **Render** — když chcete vše na jednom místě
- Vlastní VPS s Dockerem — nejlevnější dlouhodobě (např. Hetzner CX22 ~5 €/měsíc)

## Co dodělat (roadmap)

### Fáze 1 — funkční MVP (2-3 týdny)
- [ ] Autentizace (NextAuth / Lucia) pro zákazníky a admin
- [ ] Detail produktu + listing kategorie (UI)
- [ ] Košík (server-side přes `Cart` model)
- [ ] Checkout flow (adresa → doprava → platba → potvrzení)
- [ ] Integrace ComGate / GoPay (platby kartou online)
- [ ] Email notifikace přes Resend (potvrzení objednávky, posíláme, doručeno)
- [ ] Upload produktových fotek na S3 / Cloudflare R2

### Fáze 2 — admin (1-2 týdny)
- [ ] CRUD produktů, kategorií, dopravy/platby
- [ ] Detail objednávky s aktualizací stavu
- [ ] Funkce pro navážení (obsluha zadá actual_weight, systém přepočítá cenu)
- [ ] Generování PDF faktur (např. přes `pdf-lib` nebo `puppeteer`)
- [ ] Statistiky (Recharts) - tržby, top produkty, top zákazníci

### Fáze 3 — pokročilé (1-2 měsíce)
- [ ] EET / e-tržby (pokud relevantní)
- [ ] Skladová evidence (přijemky, výdejky)
- [ ] Účtenkový tisk
- [ ] Marketing - newsletter, slevové kódy, věrnostní program

### Fáze 4 — mobilní aplikace
- [ ] **React Native (Expo)** — stejné API, stejná logika, jen jiný UI vrstva.
      Doporučuji udělat aplikaci až po stabilizaci webu, sdílet `lib/` přes monorepo
      (Turborepo nebo Nx).

## Struktura

```
.
├── prisma/
│   ├── schema.prisma     # databázové schéma
│   └── seed.ts           # testovací data
├── src/
│   ├── app/
│   │   ├── page.tsx            # homepage
│   │   ├── layout.tsx
│   │   ├── admin/              # administrace
│   │   ├── produkty/[slug]/    # detail produktu
│   │   ├── kategorie/[slug]/   # listing kategorie
│   │   ├── kosik/              # košík
│   │   ├── objednavka/         # checkout
│   │   └── api/
│   │       ├── products/
│   │       ├── orders/
│   │       ├── categories/
│   │       ├── shipping-methods/
│   │       └── payment-methods/
│   ├── lib/
│   │   ├── prisma.ts     # Prisma client singleton
│   │   └── pricing.ts    # DPH, váhové produkty, souhrn objednávky
│   └── components/
└── package.json
```

## Náklady oproti Shoptetu

| Položka | Shoptet | Vlastní řešení |
|---|---|---|
| Platforma | 2 400 Kč | 0 Kč (open-source) |
| DB hosting | v ceně | ~150 Kč (Neon Pro) nebo 0 Kč (free tier) |
| App hosting | v ceně | ~200 Kč (Vercel Hobby zdarma do limitu) |
| Doména | platit zvlášť | 200 Kč/rok |
| Platby (ComGate) | platit zvlášť | 1.2 % + 1 Kč/transakce |
| **Měsíčně** | **~2 400 Kč** | **~350 Kč** |

Úspora ~2 050 Kč/měsíc = ~24 600 Kč/rok. Návratnost vývoje (řekněme 60-100 hodin)
podle hodinovky.

## Důležité poznámky

- **Před produkcí změnit admin heslo** — v seedu je `zmente-toto-heslo`
- **NEXTAUTH_SECRET** vygenerovat: `openssl rand -base64 32`
- **Backup** databáze řešit od prvního dne (Neon má automaticky, jinak nastavit cron)
- **Fakturace v CZ** má specifika (rozpis DPH po sazbách na faktuře) — řešeno
  v `lib/pricing.ts` přes `vatBreakdown` v `OrderTotals`
