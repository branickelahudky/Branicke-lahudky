import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getProductDetail } from '@/app/(shop)/_lib/getProductDetail'
import { ProductDetailContent } from '@/app/(shop)/_components/ProductDetailContent'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductDetail(slug)
  if (!product) return {}
  return {
    title: product.name,
    description: product.shortDescription ?? undefined,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductDetail(slug)
  if (!product) notFound()

  return (
    <div className="mx-auto max-w-4xl">
      <ProductDetailContent product={product} />
    </div>
  )
}
