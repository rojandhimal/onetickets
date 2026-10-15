import sharp from 'sharp';

export const BANNER_MAX_WIDTH = 2160;

export interface ProcessedBanner {
  image: Buffer;
  width: number;
  height: number;
  /** 1200 × 630 JPEG for link previews (Open Graph), which can't always show WebP. */
  ogImage: Buffer;
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export class UnsupportedImageError extends Error {}

/**
 * Turns an upload into a 2:1 WebP banner. The image is decoded and re-encoded, so only pixels
 * survive: EXIF (including GPS position), ICC extras and anything smuggled after the image data
 * are dropped. Phone photos are turned upright first. Only JPEG, PNG and WebP are decoded,
 * whatever the request's Content-Type says.
 */
/**
 * JPEG, PNG or WebP by their first bytes, checked before any decoder sees the upload, so other
 * formats the image library could parse (SVG, GIF, TIFF, HEIF) never reach it.
 */
export function looksLikeAllowedImage(upload: Buffer): boolean {
  const jpeg = upload.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = upload
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp =
    upload.subarray(0, 4).toString('latin1') === 'RIFF' &&
    upload.subarray(8, 12).toString('latin1') === 'WEBP';
  return jpeg || png || webp;
}

export async function processBanner(upload: Buffer): Promise<ProcessedBanner> {
  if (!looksLikeAllowedImage(upload)) {
    throw new UnsupportedImageError('Only JPEG, PNG or WebP images.');
  }
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(upload, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new UnsupportedImageError('Not an image.');
  }
  if (
    !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
    (metadata.pages && metadata.pages > 1)
  ) {
    throw new UnsupportedImageError('Only JPEG, PNG or WebP images.');
  }
  const upright = metadata.autoOrient ?? { width: metadata.width, height: metadata.height };
  const width = Math.min(BANNER_MAX_WIDTH, upright.width, upright.height * 2);
  const height = Math.max(1, Math.round(width / 2));
  try {
    const { data, info } = await sharp(upload, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    // From the 2:1 banner, so the preview shows what the page shows (630/1200 is close to 1:2,
    // so the crop trims only a sliver top and bottom).
    const ogImage = await sharp(data)
      .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { image: data, width: info.width, height: info.height, ogImage };
  } catch {
    throw new UnsupportedImageError('The image could not be read.');
  }
}
