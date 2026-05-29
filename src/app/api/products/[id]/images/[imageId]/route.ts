import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { deleteFromR2 } from '@/lib/image-upload'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const { user } = await requireAuth()
    if (user.role === 'STAFF') {
      return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 })
    }

    const { id: productId, imageId } = await params

    const image = await prisma.productImage.findUnique({ where: { id: imageId } })
    if (!image || image.productId !== productId) {
      return NextResponse.json({ error: 'Fotografie nenalezena' }, { status: 404 })
    }

    await Promise.all([
      deleteFromR2(image.storageKey),
      deleteFromR2(image.thumbnailKey),
    ])

    await prisma.productImage.delete({ where: { id: imageId } })

    if (image.isPrimary) {
      const next = await prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      })
      if (next) {
        await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Image delete error:', err)
    return NextResponse.json({ error: 'Chyba při mazání' }, { status: 500 })
  }
}
