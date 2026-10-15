import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { looksLikeAllowedImage, processBanner, UnsupportedImageError } from './banner-image.js';

async function jpeg(width: number, height: number, withExif = false): Promise<Buffer> {
  let image = sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  }).jpeg();
  if (withExif) {
    image = image.withExif({ IFD0: { Copyright: 'priya.sharma@example.com' } });
  }
  return image.toBuffer();
}

describe('processBanner', () => {
  it('crops to 2:1 WebP and caps the width', async () => {
    const result = await processBanner(await jpeg(4000, 3000));
    expect(result).toMatchObject({ width: 2160, height: 1080 });
    expect((await sharp(result.image).metadata()).format).toBe('webp');
    const og = await sharp(result.ogImage).metadata();
    expect(og).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
    expect(og.exif).toBeUndefined();
  });

  it('never enlarges a small image', async () => {
    const result = await processBanner(await jpeg(800, 800));
    expect(result).toMatchObject({ width: 800, height: 400 });
  });

  it('strips EXIF', async () => {
    const result = await processBanner(await jpeg(1200, 600, true));
    const metadata = await sharp(result.image).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(result.image.includes('priya.sharma')).toBe(false);
  });

  it('refuses anything that is not a JPEG, PNG or WebP', async () => {
    await expect(processBanner(Buffer.from('<svg onload="alert(1)"/>'))).rejects.toBeInstanceOf(
      UnsupportedImageError,
    );
    const gif = await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#fff' },
    })
      .gif()
      .toBuffer();
    await expect(processBanner(gif)).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('only lets JPEG, PNG and WebP signatures reach the decoder', async () => {
    const make = (format: 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff') =>
      sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
        .toFormat(format)
        .toBuffer();
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      expect(looksLikeAllowedImage(await make(format))).toBe(true);
    }
    for (const format of ['gif', 'tiff'] as const) {
      expect(looksLikeAllowedImage(await make(format))).toBe(false);
    }
    expect(looksLikeAllowedImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(
      false,
    );
  });
});
