import sharp from 'sharp'

/**
 * Jednotné usazení produktu na čtverec — „Shoptet způsob":
 *   1) trim() ořízne jednolité (bílé/téměř-bílé) pozadí kolem produktu
 *   2) produkt se vepíše (fit inside) do vnitřní plochy ~82 % čtverce
 *   3) zbytek se rovnoměrně dopolstruje bílou (extend) → produkt je
 *      vždy stejně opticky velký, celý viditelný, s jednotným okrajem
 */

export const WHITE = { r: 255, g: 255, b: 255, alpha: 1 as const }
export const INNER_RATIO = 0.82        // produkt zabírá ~82 % strany čtverce
export const TRIM_THRESHOLD = 22       // tolerance trimu (zvládne i téměř-bílé okraje)
export const MIN_KEPT_RATIO = 0.05     // když by trim ořízl >95 % plochy → považuj za selhání

export type TrimInfo = {
  trimmedBuffer: Buffer  // obsah po trimu (nebo pre, když trim nic nenašel)
  preBuffer: Buffer      // celý obrázek po rotate+flatten, bez trimu
  srcWidth: number
  srcHeight: number
  bboxWidth: number
  bboxHeight: number
  offsetLeft: number
  offsetTop: number
  trimmed: boolean
}

/** Spočítá podíl plochy, kterou produkt (bounding box) zabírá z originálu. */
export function keptAreaRatio(info: TrimInfo): number {
  const src = info.srcWidth * info.srcHeight
  if (src <= 0) return 1
  return (info.bboxWidth * info.bboxHeight) / src
}

/**
 * Ořízne jednolité pozadí a vrátí bounding box produktu + buffer.
 * Nikdy nevyhazuje výjimku z trimu — při selhání vrací pre (neoříznuto).
 */
export async function trimToContent(input: Buffer, threshold = TRIM_THRESHOLD): Promise<TrimInfo> {
  // rotate dle EXIF, sjednoť pozadí na bílou (kvůli PNG s průhledností)
  const pre = await sharp(input).rotate().flatten({ background: WHITE }).toBuffer({ resolveWithObject: true })
  const srcWidth = pre.info.width
  const srcHeight = pre.info.height

  try {
    const out = await sharp(pre.data)
      .trim({ background: '#ffffff', threshold })
      .toBuffer({ resolveWithObject: true })

    const info = out.info as typeof out.info & { trimOffsetLeft?: number; trimOffsetTop?: number }
    return {
      trimmedBuffer: out.data,
      preBuffer: pre.data,
      srcWidth,
      srcHeight,
      bboxWidth: out.info.width,
      bboxHeight: out.info.height,
      offsetLeft: info.trimOffsetLeft ?? 0,
      offsetTop: info.trimOffsetTop ?? 0,
      trimmed: out.info.width !== srcWidth || out.info.height !== srcHeight,
    }
  } catch {
    // Jednolitý obrázek / trim selhal → ber celý obrázek
    return {
      trimmedBuffer: pre.data,
      preBuffer: pre.data,
      srcWidth,
      srcHeight,
      bboxWidth: srcWidth,
      bboxHeight: srcHeight,
      offsetLeft: 0,
      offsetTop: 0,
      trimmed: false,
    }
  }
}

/** Vepíše obsah do vnitřní plochy a dopolstruje bílou na čtverec size×size. */
export async function padToSquare(
  content: Buffer,
  size: number,
  innerRatio = INNER_RATIO,
  quality = 85,
): Promise<Buffer> {
  const inner = Math.round(size * innerRatio)

  const resized = await sharp(content)
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
    .toBuffer({ resolveWithObject: true })

  const w = resized.info.width
  const h = resized.info.height
  const top = Math.floor((size - h) / 2)
  const bottom = size - h - top
  const left = Math.floor((size - w) / 2)
  const right = size - w - left

  return sharp(resized.data)
    .extend({ top, bottom, left, right, background: WHITE })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality, progressive: true })
    .toBuffer()
}

/**
 * Kompletní trim + pad na čtverec. Bezpečné pro uploady:
 * když by trim ořízl >95 % plochy (selhání / stín / gradient), použije
 * celý obrázek místo oříznutého, takže fotka se nikdy nezničí.
 */
export async function trimPadToSquare(
  input: Buffer,
  size: number,
  innerRatio = INNER_RATIO,
  quality = 85,
  threshold = TRIM_THRESHOLD,
): Promise<Buffer> {
  const t = await trimToContent(input, threshold)
  const content = keptAreaRatio(t) < MIN_KEPT_RATIO ? t.preBuffer : t.trimmedBuffer
  return padToSquare(content, size, innerRatio, quality)
}
