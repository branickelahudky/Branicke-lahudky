import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'
import { processAndUpload } from '@/lib/image-upload'

export const maxDuration = 30

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAuth()
    if (user.role === 'STAFF') {
      return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 })
    }

    const { id: productId } = await params

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!product) return NextResponse.json({ error: 'Produkt nenalezen' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Soubor chybí' }, { status: 400 })

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Nepodporovaný formát. Povolené: JPG, PNG, WebP' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Soubor je příliš velký (max 10 MB)' }, { status: 400 })
    }

    const count = await prisma.productImage.count({ where: { productId } })
    if (count >= 6) {
      return NextResponse.json({ error: 'Maximum 6 fotek na produkt bylo dosaženo' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await processAndUpload(buffer, productId)

    const image = await prisma.productImage.create({
      data: {
        productId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        storageKey: result.storageKey,
        thumbnailKey: result.thumbnailKey,
        width: result.width,
        height: result.height,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        sortOrder: count,
        isPrimary: count === 0,
      },
    })

    return NextResponse.json({ image })
  } catch (err) {
    console.error('Image upload error:', err)
    return NextResponse.json({ error: 'Chyba při nahrávání' }, { status: 500 })
  }
}
