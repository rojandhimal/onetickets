import sharp from 'sharp';

export const BANNER_MAX_WIDTH = 2160;

export interface ProcessedBanner {
  image: Buffer;
  width: number;
  height: number;
}

export class UnsupportedImageError extends Error {}

/**
 * Turns an upload into a 2:1 WebP banner. The image is decoded and re-encoded, so only pixels
 * survive: EXIF (including GPS position), ICC extras and anything smuggled after the image data
 * are dropped. Phone photos are turned upright first. Only JPEG, PNG and WebP are decoded,
 * whatever the request's Content-Type says.
 */
export async function processBanner(upload: Buffer): Promise<ProcessedBanner> {
  let metadata: sharp.Metadata;
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
    return { image: data, width: info.width, height: info.height };
  } catch {
    throw new UnsupportedImageError('The image could not be read.');
  }
}
