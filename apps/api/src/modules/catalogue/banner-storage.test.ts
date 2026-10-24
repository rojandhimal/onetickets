import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { bannerStorageFromEnv, LocalDiskBannerStorage, S3BannerStorage } from './banner-storage.js';

const NAME = '6f1c2a5e-8b3d-4f7a-9c10-2d3e4f5a6b7c.webp';
const OG_NAME = '6f1c2a5e-8b3d-4f7a-9c10-2d3e4f5a6b7c-og.jpg';
const BASE = 'https://onetickets.example.test/api/public/banners';

/** Records every command and answers GetObject from `objects`, like the bucket would. */
function fakeS3(objects: Record<string, Buffer> = {}, getError?: string) {
  const sent: unknown[] = [];
  const client: Pick<S3Client, 'send'> = {
    send: (async (command: unknown) => {
      sent.push(command);
      if (command instanceof GetObjectCommand) {
        if (getError) throw Object.assign(new Error(getError), { name: getError });
        const body = objects[command.input.Key!];
        if (!body) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
        return { Body: { transformToByteArray: async () => new Uint8Array(body) } };
      }
      return {};
    }) as S3Client['send'],
  };
  return { client, sent };
}

describe('S3BannerStorage', () => {
  it('puts banners under banners/ with their content type', async () => {
    const { client, sent } = fakeS3();
    const store = new S3BannerStorage('uploads-test', BASE, client);
    await store.put(NAME, Buffer.from('webp'));
    await store.put(OG_NAME, Buffer.from('jpeg'));
    expect(sent.map((c) => (c as PutObjectCommand).input)).toEqual([
      expect.objectContaining({
        Bucket: 'uploads-test',
        Key: `banners/${NAME}`,
        ContentType: 'image/webp',
      }),
      expect.objectContaining({
        Bucket: 'uploads-test',
        Key: `banners/${OG_NAME}`,
        ContentType: 'image/jpeg',
      }),
    ]);
    expect(sent.every((c) => c instanceof PutObjectCommand)).toBe(true);
  });

  it('reads the bytes back, and a missing key as null whichever way S3 says so', async () => {
    const stored = { [`banners/${NAME}`]: Buffer.from('bytes') };
    expect(await new S3BannerStorage('b', BASE, fakeS3(stored).client).read(NAME)).toEqual(
      Buffer.from('bytes'),
    );
    expect(await new S3BannerStorage('b', BASE, fakeS3().client).read(NAME)).toBeNull();
    // No ListBucket on the task role, so S3 answers a missing key with AccessDenied.
    expect(
      await new S3BannerStorage('b', BASE, fakeS3({}, 'AccessDenied').client).read(NAME),
    ).toBeNull();
  });

  it('passes on any other S3 error', async () => {
    const store = new S3BannerStorage('b', BASE, fakeS3({}, 'SlowDown').client);
    await expect(store.read(NAME)).rejects.toThrow('SlowDown');
  });

  it('deletes the object', async () => {
    const { client, sent } = fakeS3();
    await new S3BannerStorage('b', BASE, client).remove(NAME);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((sent[0] as DeleteObjectCommand).input).toEqual({ Bucket: 'b', Key: `banners/${NAME}` });
  });

  it('refuses keys the api never makes, before calling S3', async () => {
    const { client, sent } = fakeS3();
    const store = new S3BannerStorage('b', BASE, client);
    for (const key of ['../secret.webp', `${NAME}/../x`, 'banner.png', `${NAME.toUpperCase()}`]) {
      await expect(store.put(key, Buffer.from('x'))).rejects.toThrow('Invalid banner key');
      await expect(store.read(key)).rejects.toThrow('Invalid banner key');
      await expect(store.remove(key)).rejects.toThrow('Invalid banner key');
    }
    expect(sent).toHaveLength(0);
  });

  it('serves banners through the api, so the public URL is unchanged', () => {
    expect(new S3BannerStorage('b', BASE, fakeS3().client).publicUrl(NAME)).toBe(`${BASE}/${NAME}`);
  });
});

describe('bannerStorageFromEnv', () => {
  it('uses the uploads bucket for s3, and the api route for URLs', () => {
    const store = bannerStorageFromEnv({
      BANNER_STORAGE: 's3',
      UPLOADS_BUCKET: 'uploads-test',
      WEB_URL: 'https://onetickets.example.test',
    });
    expect(store).toBeInstanceOf(S3BannerStorage);
    expect(store.publicUrl(NAME)).toBe(`${BASE}/${NAME}`);
  });

  it('refuses s3 without a bucket, and unknown stores', () => {
    expect(() => bannerStorageFromEnv({ BANNER_STORAGE: 's3' })).toThrow(/UPLOADS_BUCKET/);
    expect(() => bannerStorageFromEnv({ BANNER_STORAGE: 'gcs' })).toThrow(/not supported/);
  });

  it('defaults to local disk', () => {
    expect(bannerStorageFromEnv({})).toBeInstanceOf(LocalDiskBannerStorage);
  });
});
