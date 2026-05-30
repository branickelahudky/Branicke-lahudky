import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2-client'
import { deleteFromR2 } from '@/lib/image-upload'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-roles'

const MAX_MB = 5
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

async function getOrCreateIdentity() {
  const existing = await prisma.siteIdentity.findFirst()
  if (existing) return existing
  return prisma.siteIdentity.create({ data: {} })
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth()
    if (user.role === 'STAFF') {
      return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file || (type !== 'logo' && type !== 'favicon')) {
      return NextResponse.json({ error: 'Chybí soubor nebo typ.' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Povolené formáty: JPG, PNG, WebP.' }, { status: 400 })
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Soubor je příliš velký (max ${MAX_MB} MB).` }, { status: 400 })
    }

    const raw = Buffer.from(await file.arrayBuffer())

    const processedBuffer =
      type === 'logo'
        ? await sharp(raw)
            .rotate()
            .resize(800, 400, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer()
        : await sharp(raw)
            .rotate()
            .resize(64, 64, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toBuffer()

    const storageKey = `identity/${type}-${Date.now()}.jpg`

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: storageKey,
        Body: processedBuffer,
        ContentType: 'image/jpeg',
      }),
    )

    const url = `${R2_PUBLIC_URL}/${storageKey}`
    const identity = await getOrCreateIdentity()

    // Delete old file from R2
    const oldKey = type === 'logo' ? identity.logoStorageKey : identity.faviconStorageKey
    if (oldKey) await deleteFromR2(oldKey).catch(() => {})

    await prisma.siteIdentity.update({
      where: { id: identity.id },
      data:
        type === 'logo'
          ? { logoUrl: url, logoStorageKey: storageKey }
          : { faviconUrl: url, faviconStorageKey: storageKey },
    })

    return NextResponse.json({ url, storageKey })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chyba při nahrávání'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
