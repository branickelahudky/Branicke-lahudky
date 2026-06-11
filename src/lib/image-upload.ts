import crypto from 'crypto'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from './r2-client'
import { trimToContent, padToSquare, keptAreaRatio, MIN_KEPT_RATIO } from './normalize-image'

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

  // Trim jednolitého pozadí + jednotné usazení produktu (~82 % plochy).
  // Když by trim ořízl >95 % plochy, použij celý obrázek (fotku nezničíme).
  const trim = await trimToContent(buffer)
  const content = keptAreaRatio(trim) < MIN_KEPT_RATIO ? trim.preBuffer : trim.trimmedBuffer

  const [mainBuffer, thumbBuffer] = await Promise.all([
    padToSquare(content, 800, undefined, 85), // hlavní 800×800
    padToSquare(content, 400, undefined, 82), // thumbnail 400×400
  ])

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
    width: 800,
    height: 800,
    fileSize: mainBuffer.length,
    mimeType: 'image/jpeg',
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  if (!key) return
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}
