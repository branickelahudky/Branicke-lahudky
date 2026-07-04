import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getProductDetail } from '@/app/(shop)/_lib/getProductDetail'
import { ProductModal } from '@/app/(shop)/_components/ProductModal'
import { ProductDetailContent } from '@/app/(shop)/_components/ProductDetailContent'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProductModalPage({ params }: Props) {
  const { slug } = await params
  const [product, branch] = await Promise.all([
    getProductDetail(slug),
    prisma.branchSettings.findFirst({ select: { phone1: true } }),
  ])
  if (!product) notFound()

  return (
    <ProductModal>
      <ProductDetailContent product={product} branchPhone={branch?.phone1 ?? null} />
    </ProductModal>
  )
}
