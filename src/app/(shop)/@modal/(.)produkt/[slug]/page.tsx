import { notFound } from 'next/navigation'
import { getProductDetail } from '@/app/(shop)/_lib/getProductDetail'
import { ProductModal } from '@/app/(shop)/_components/ProductModal'
import { ProductDetailContent } from '@/app/(shop)/_components/ProductDetailContent'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProductModalPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductDetail(slug)
  if (!product) notFound()

  return (
    <ProductModal>
      <ProductDetailContent product={product} />
    </ProductModal>
  )
}
