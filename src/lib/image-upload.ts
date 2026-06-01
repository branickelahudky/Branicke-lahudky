import crypto from 'crypto'
import sharp from 'sharp'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from './r2-client'

type UploadResult = {
  url: string
  thumbnailUrl: string
  storageKey: string
  thumbnailKey: string
  width: number
  height: number
  fileSize: number
  mimeType: string
}

export async function processAndUpload(
  buffer: Buffer,
  productId: string,
): Promise<UploadResult> {
  const hex = crypto.randomBytes(8).toString('hex')
  const storageKey = `products/${productId}/${hex}.jpg`
  const thumbnailKey = `products/${productId}/${hex}-thumb.jpg`

  const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

  const [mainResult, thumbBuffer] = await Promise.all([
    // Hlavní: čtverec 800×800, celá fotka (contain), bílé pozadí
    sharp(buffer)
      .rotate()
      .resize(800, 800, { fit: 'contain', background: WHITE })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer({ resolveWithObject: true }),
    // Thumbnail: čtverec 400×400, celá fotka (contain), bílé pozadí
    sharp(buffer)
      .rotate()
      .resize(400, 400, { fit: 'contain', background: WHITE })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer(),
  ])

  const { data: mainBuffer, info } = mainResult

  await Promise.all([
    r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: storageKey,
        Body: mainBuffer,
        ContentType: 'image/jpeg',
      }),
    ),
    r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: thumbnailKey,
        Body: thumbBuffer,
        ContentType: 'image/jpeg',
      }),
    ),
  ])

  return {
    url: `${R2_PUBLIC_URL}/${storageKey}`,
    thumbnailUrl: `${R2_PUBLIC_URL}/${thumbnailKey}`,
    storageKey,
    thumbnailKey,
    width: info.width,
    height: info.height,
    fileSize: mainBuffer.length,
    mimeType: 'image/jpeg',
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  if (!key) return
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}
