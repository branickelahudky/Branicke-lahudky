import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getProductDetail } from '@/app/(shop)/_lib/getProductDetail'
import { ProductDetailContent } from '@/app/(shop)/_components/ProductDetailContent'
import { JsonLd } from '@/app/(shop)/_components/JsonLd'
import { productAutoTitle, productAutoDescription } from '@/lib/seo'
import { productJsonLd, breadcrumbJsonLd } from '@/lib/structured-data'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductDetail(slug)
  if (!product) return {}

  const title = productAutoTitle(product, product.category.name)
  const description = productAutoDescription(product) ?? undefined
  const mainImage = product.images[0]?.url

  return {
    title,
    description,
    alternates: { canonical: `/produkt/${product.slug}` },
    ...(product.isIndexable ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description,
      url: `/produkt/${product.slug}`,
      ...(mainImage ? { images: [{ url: mainImage }] } : {}),
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const [product, branch] = await Promise.all([
    getProductDetail(slug),
    prisma.branchSettings.findFirst({ select: { phone1: true } }),
  ])
  if (!product) notFound()

  const breadcrumbs = [
    { name: 'Domů', path: '/' },
    ...(product.category.parent
      ? [{ name: product.category.parent.name, path: `/kategorie/${product.category.parent.slug}` }]
      : []),
    { name: product.category.name, path: `/kategorie/${product.category.slug}` },
    { name: product.name, path: `/produkt/${product.slug}` },
  ]

  return (
    <div className="mx-auto max-w-4xl">
      <JsonLd data={productJsonLd(product)} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <ProductDetailContent product={product} branchPhone={branch?.phone1 ?? null} />
    </div>
  )
}
