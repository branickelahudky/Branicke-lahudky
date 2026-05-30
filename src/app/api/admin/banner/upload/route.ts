import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2-client'
import { requireAuth } from '@/lib/auth-roles'

const MAX_MB = 15
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_WIDTH = 1920

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth()
    if (user.role === 'STAFF') {
      return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Chybí soubor.' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Povolené formáty: JPG, PNG, WebP.' }, { status: 400 })
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Soubor je příliš velký (max ${MAX_MB} MB).` }, { status: 400 })
    }

    const raw = Buffer.from(await file.arrayBuffer())

    const processedBuffer = await sharp(raw)
      .rotate()
      .resize(MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, progressive: true })
      .toBuffer()

    const storageKey = `banners/banner-${Date.now()}.jpg`

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: storageKey,
        Body: processedBuffer,
        ContentType: 'image/jpeg',
      }),
    )

    const imageUrl = `${R2_PUBLIC_URL}/${storageKey}`
    return NextResponse.json({ imageUrl, storageKey })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chyba při nahrávání'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
