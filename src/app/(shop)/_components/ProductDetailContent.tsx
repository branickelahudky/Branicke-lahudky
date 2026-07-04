'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '../_context/CartContext'
import { flyToCart } from '../_lib/flyToCart'
import { ProductCard } from './ProductCard'
import { HorizontalShelf } from './HorizontalShelf'
import type { ProductDetail } from '../_lib/getProductDetail'

function fmtKc(n: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency', currency: 'CZK', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

const COUNTRIES: Record<string, string> = {
  CZ: 'Česká republika', SK: 'Slovensko', AT: 'Rakousko',
  DE: 'Německo', IT: 'Itálie', FR: 'Francie', ES: 'Španělsko',
  PL: 'Polsko', NL: 'Nizozemsko', NO: 'Norsko',
  IS: 'Island', GB: 'Velká Británie', IE: 'Irsko',
  DK: 'Dánsko', SE: 'Švédsko', FI: 'Finsko', PT: 'Portugalsko',
  GR: 'Řecko', CA: 'Kanada', US: 'USA',
}

const STORAGE_LABELS: Record<string, string> = {
  FROZEN:       'Zmrazeno (−18 °C a níže)',
  REFRIGERATED: 'Chlazeno (0–5 °C)',
  COOL:         'Chladno (do 14 °C)',
  ROOM_TEMP:    'Pokojová teplota',
}

const ALLERGEN_NAMES: Record<string, string> = {
  '1':  'Lepek',      '2': 'Korýši',    '3': 'Vejce',
  '4':  'Ryby',       '5': 'Arašídy',   '6': 'Sója',
  '7':  'Mléko',      '8': 'Ořechy',    '9': 'Celer',
  '10': 'Hořčice',   '11': 'Sezam',    '12': 'SO₂/siřičitany',
  '13': 'Lupina',    '14': 'Měkkýši',
}

function StockBadge({ status, qty, track }: { status: string; qty: number; track: boolean }) {
  if (!track || status === 'IN_STOCK')
    return <span className="inline-flex items-center gap-1 text-sm text-green-600">● Skladem</span>
  if (status === 'LOW_STOCK')
    return <span className="inline-flex items-center gap-1 text-sm text-amber-600">● Poslední kusy ({qty})</span>
  if (status === 'OUT_OF_STOCK')
    return <span className="inline-flex items-center gap-1 text-sm text-red-600">● Není skladem</span>
  if (status === 'ON_REQUEST')
    return <span className="inline-flex items-center gap-1 text-sm text-shop-muted">● Na dotaz</span>
  return <span className="inline-flex items-center gap-1 text-sm text-shop-muted">● Dočasně nedostupné</span>
}

export function ProductDetailContent({
  product,
  branchPhone = null,
}: {
  product: ProductDetail
  /** Telefon z Provozovny — pro „Cena na dotaz — kontaktujte nás" */
  branchPhone?: string | null
}) {
  const { addItem, openCart } = useCart()
  const [qty, setQty] = useState(1)
  const [activeImg, setActiveImg] = useState(0)
  const [activeVariant, setActiveVariant] = useState<string | null>(
    product.variants.length > 0 ? product.variants[0].id : null
  )

  const isAvailable  = product.stockStatus !== 'OUT_OF_STOCK'
  const prefix       = product.isWeightBased ? 'od ' : ''

  const activeSalePrice =
    product.isOnSale && product.salePriceWithVat && product.salePriceWithVat > 0
      ? product.salePriceWithVat
      : null
  const displayPrice = activeSalePrice ?? product.priceWithVat

  const selectedVariant = activeVariant
    ? product.variants.find(v => v.id === activeVariant) ?? null
    : null
  const variantPrice = selectedVariant ? selectedVariant.priceWithVat : null

  // „Cena na dotaz" (cena 0) nejde koupit online — server ji stejně odmítne
  const effectivePrice = variantPrice ?? displayPrice
  const canBuy = effectivePrice > 0

  const badge = product.isOnSale ? { label: 'Akce',    cls: 'bg-red-500 text-white' }
    : product.isNew              ? { label: 'Novinka', cls: 'bg-gold text-shop-bg'  }
    : product.isFeatured         ? { label: 'Tip',     cls: 'bg-blue-600 text-white' }
    : null

  const mainImage = product.images[activeImg]
  const mainSrc   = mainImage?.url || null

  function handleAdd(e: React.MouseEvent) {
    if (!isAvailable || !canBuy) return
    const origin = e.currentTarget as HTMLElement
    const price = variantPrice ?? displayPrice
    const thumb = mainImage?.thumbnailUrl ?? mainImage?.url ?? null
    addItem({
      productId:           product.id,
      // Cena i váha musí odpovídat konkrétní variantě — server si je při
      // objednávce stejně ověří z DB podle variantId
      variantId:           selectedVariant?.id ?? null,
      variantName:         selectedVariant?.name ?? null,
      weightGrams:         selectedVariant?.weightGrams ?? product.weightGrams ?? null,
      slug:                product.slug,
      sku:                 product.sku,
      name:                product.name,
      thumbnailUrl:        thumb,
      unitPriceWithVat:    price,
      unitPriceWithoutVat: selectedVariant?.priceWithoutVat ?? product.priceWithoutVat,
      vatRate:             product.vatRate,
      isWeightBased:       product.isWeightBased,
      unit:                product.unit,
    }, qty)
    // Letící fotka z tlačítka „Do košíku" k ikoně v hlavičce (nad backdropem modalu)
    flyToCart(origin, thumb, () => openCart('auto'))
  }

  const weightLabel = product.weightGrams
    ? product.weightGrams >= 1000
      ? `${(product.weightGrams / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kg`
      : `${product.weightGrams} g`
    : null

  const nutrition = product.nutritionPer100g
  const hasNutrition = nutrition && Object.values(nutrition).some(v => v != null)

  const hasAllergens  = !!(product.allergenInfo || (product.allergenCodes && product.allergenCodes.length > 0))
  const hasIngredients = !!product.ingredients
  const hasParameters = !!(
    product.countryOfOrigin || product.producerName ||
    product.storageInstructions || product.useByInstructions ||
    product.storageTemp !== 'ROOM_TEMP'
  )

  return (
    <div className="p-4 sm:p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-shop-muted flex-wrap">
        <Link href="/" className="hover:text-gold transition">Domů</Link>
        {product.category.parent && (
          <>
            <span>/</span>
            <Link href={`/kategorie/${product.category.parent.slug}`} className="hover:text-gold transition">
              {product.category.parent.name}
            </Link>
          </>
        )}
        <span>/</span>
        <Link href={`/kategorie/${product.category.slug}`} className="hover:text-gold transition">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-stone-300 line-clamp-1">{product.name}</span>
      </nav>

      {/* Hlavní oblast: foto + info */}
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">

        {/* Foto vlevo */}
        <div className="sm:w-[45%] shrink-0">
          {/* Hlavní foto */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-stone-100">
            {mainSrc ? (
              <Image
                src={mainSrc}
                alt={mainImage?.altText ?? product.name}
                fill
                className="object-contain"
                sizes="(max-width: 640px) 90vw, 400px"
                priority
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <svg className="h-16 w-16 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Galerie náhledů */}
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`relative h-14 w-14 rounded-lg overflow-hidden bg-stone-100 border-2 transition ${
                    i === activeImg ? 'border-gold' : 'border-transparent hover:border-shop-border'
                  }`}
                >
                  <Image
                    src={img.thumbnailUrl || img.url}
                    alt={img.altText ?? product.name}
                    fill className="object-cover" sizes="56px" unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info vpravo */}
        <div className="flex flex-1 flex-col gap-3">
          {/* Štítek + název */}
          <div>
            {badge && (
              <span className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
                {badge.label}
              </span>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-shop-fg leading-snug">{product.name}</h1>
            <p className="mt-0.5 text-xs text-shop-muted">SKU: {product.sku}</p>
          </div>

          {/* Cena */}
          <div>
            {!canBuy ? (
              <div className="rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
                <p className="text-lg font-semibold text-shop-fg">Cena na dotaz — kontaktujte nás</p>
                <p className="mt-1 text-sm text-shop-muted">
                  Tento produkt nelze objednat online.
                  {branchPhone ? (
                    <>
                      {' '}Zavolejte nám na{' '}
                      <a href={`tel:${branchPhone.replace(/\s+/g, '')}`} className="font-medium text-gold hover:underline">
                        {branchPhone}
                      </a>{' '}
                      — rádi vám cenu spočítáme.
                    </>
                  ) : (
                    ' Ozvěte se nám — rádi vám cenu spočítáme.'
                  )}
                </p>
              </div>
            ) : variantPrice ? (
              <div>
                <p className="text-2xl font-bold text-shop-fg">{fmtKc(variantPrice)}</p>
                <p className="text-xs text-shop-muted">
                  {fmtKc(selectedVariant!.priceWithoutVat)} bez DPH
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-shop-fg">
                    {prefix}{fmtKc(displayPrice)}
                  </span>
                  {activeSalePrice && (
                    <span className="text-base text-shop-muted line-through">{fmtKc(product.priceWithVat)}</span>
                  )}
                </div>
                <p className="text-xs text-shop-muted">
                  {prefix}{fmtKc(product.priceWithoutVat)} bez DPH
                  {product.unit !== 'KS' && ` / ${product.unit.toLowerCase()}`}
                </p>
              </div>
            )}
          </div>

          {/* Dostupnost */}
          <StockBadge status={product.stockStatus} qty={product.stockQuantity} track={product.trackStock} />

          {/* Váha/jednotka */}
          {weightLabel && (
            <p className="text-sm text-shop-muted">Obsah: {weightLabel}</p>
          )}

          {/* Varianty */}
          {product.variants.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-shop-muted">Varianta</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setActiveVariant(v.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      activeVariant === v.id
                        ? 'border-gold bg-gold/10 text-gold font-semibold'
                        : 'border-shop-border text-stone-300 hover:border-gold/50 hover:text-shop-fg'
                    }`}
                  >
                    {v.name}
                    <span className="ml-1.5 text-xs opacity-70">{fmtKc(v.priceWithVat)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Počítadlo + Do košíku */}
          {canBuy && (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-0.5 rounded-xl border border-shop-border overflow-hidden">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center text-shop-fg hover:bg-shop-surface transition text-lg"
                >−</button>
                <span className="min-w-[2rem] text-center text-sm font-semibold text-shop-fg">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="flex h-10 w-10 items-center justify-center text-shop-fg hover:bg-shop-surface transition text-lg"
                >+</button>
              </div>
              <button
                onClick={handleAdd}
                disabled={!isAvailable}
                data-cart-add
                className="flex-1 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-shop-bg hover:bg-gold/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Do košíku
              </button>
            </div>
          )}

          {/* Krátký popis */}
          {product.shortDescription && (
            product.shortDescriptionIsHtml ? (
              <div
                className="product-richtext text-sm text-stone-300 leading-relaxed border-t border-shop-border pt-3 mt-1"
                dangerouslySetInnerHTML={{ __html: product.shortDescription }}
              />
            ) : (
              <p className="text-sm text-stone-300 leading-relaxed border-t border-shop-border pt-3 mt-1">
                {product.shortDescription}
              </p>
            )
          )}
        </div>
      </div>

      {/* ── Sekce pod hlavní oblastí ── */}

      {/* Delší popis */}
      {product.description && (
        <section className="mt-8 border-t border-shop-border pt-6">
          <h2 className="mb-3 text-base font-semibold text-shop-fg">Popis</h2>
          {product.descriptionIsHtml ? (
            <div
              className="product-richtext text-sm text-stone-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : (
            <div className="text-sm text-stone-300 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          )}
        </section>
      )}

      {/* Složení & alergeny */}
      {(hasIngredients || hasAllergens) && (
        <section className="mt-8 border-t border-shop-border pt-6">
          <h2 className="mb-3 text-base font-semibold text-shop-fg">Složení & alergeny</h2>
          {product.ingredients && (
            <p className="mb-3 text-sm text-stone-300 leading-relaxed">
              <span className="font-medium text-shop-fg">Složení: </span>
              {product.ingredients}
            </p>
          )}
          {product.allergenCodes && product.allergenCodes.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-sm font-medium text-shop-fg">Alergeny:</p>
              <div className="flex flex-wrap gap-1.5">
                {product.allergenCodes.map(code => (
                  <span key={code} className="rounded-full border border-shop-border px-2.5 py-0.5 text-xs text-stone-300">
                    {ALLERGEN_NAMES[code] ?? `Alergen ${code}`}
                  </span>
                ))}
              </div>
            </div>
          )}
          {product.allergenInfo && (
            <p className="text-xs text-shop-muted">{product.allergenInfo}</p>
          )}
        </section>
      )}

      {/* Výživové hodnoty */}
      {hasNutrition && (
        <section className="mt-8 border-t border-shop-border pt-6">
          <h2 className="mb-3 text-base font-semibold text-shop-fg">Výživové hodnoty na 100 g</h2>
          <table className="w-full max-w-sm text-sm">
            <tbody className="divide-y divide-shop-border">
              {nutrition!.energyKcal != null && (
                <tr>
                  <td className="py-1.5 text-stone-300">Energetická hodnota</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">
                    {nutrition!.energyKj != null && `${nutrition!.energyKj} kJ / `}{nutrition!.energyKcal} kcal
                  </td>
                </tr>
              )}
              {nutrition!.fat != null && (
                <tr>
                  <td className="py-1.5 text-stone-300">Tuk</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">{nutrition!.fat} g</td>
                </tr>
              )}
              {nutrition!.saturatedFat != null && (
                <tr>
                  <td className="py-1.5 pl-4 text-stone-300">z toho nasycené mastné kyseliny</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">{nutrition!.saturatedFat} g</td>
                </tr>
              )}
              {nutrition!.carbohydrates != null && (
                <tr>
                  <td className="py-1.5 text-stone-300">Sacharidy</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">{nutrition!.carbohydrates} g</td>
                </tr>
              )}
              {nutrition!.sugars != null && (
                <tr>
                  <td className="py-1.5 pl-4 text-stone-300">z toho cukry</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">{nutrition!.sugars} g</td>
                </tr>
              )}
              {nutrition!.protein != null && (
                <tr>
                  <td className="py-1.5 text-stone-300">Bílkoviny</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">{nutrition!.protein} g</td>
                </tr>
              )}
              {nutrition!.salt != null && (
                <tr>
                  <td className="py-1.5 text-stone-300">Sůl</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">{nutrition!.salt} g</td>
                </tr>
              )}
              {nutrition!.fiber != null && (
                <tr>
                  <td className="py-1.5 text-stone-300">Vláknina</td>
                  <td className="py-1.5 text-right text-shop-fg font-medium">{nutrition!.fiber} g</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Parametry */}
      {hasParameters && (
        <section className="mt-8 border-t border-shop-border pt-6">
          <h2 className="mb-3 text-base font-semibold text-shop-fg">Parametry</h2>
          <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-8 text-sm">
            {product.countryOfOrigin && (
              <>
                <dt className="text-shop-muted">Země původu</dt>
                <dd className="text-shop-fg">{COUNTRIES[product.countryOfOrigin] ?? product.countryOfOrigin}</dd>
              </>
            )}
            {product.producerName && (
              <>
                <dt className="text-shop-muted">Výrobce</dt>
                <dd className="text-shop-fg">{product.producerName}</dd>
              </>
            )}
            {product.storageTemp && product.storageTemp !== 'ROOM_TEMP' && (
              <>
                <dt className="text-shop-muted">Skladování</dt>
                <dd className="text-shop-fg">{STORAGE_LABELS[product.storageTemp] ?? product.storageTemp}</dd>
              </>
            )}
            {product.storageInstructions && (
              <>
                <dt className="text-shop-muted">Pokyny ke skladování</dt>
                <dd className="text-shop-fg">{product.storageInstructions}</dd>
              </>
            )}
            {product.useByInstructions && (
              <>
                <dt className="text-shop-muted">Po otevření spotřebovat</dt>
                <dd className="text-shop-fg">{product.useByInstructions}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Související produkty */}
      {product.relatedProducts.length > 0 && (
        <div className="mt-8 border-t border-shop-border pt-6 -mx-4 sm:-mx-6">
          <HorizontalShelf title="Související produkty">
            {product.relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </HorizontalShelf>
        </div>
      )}
    </div>
  )
}
