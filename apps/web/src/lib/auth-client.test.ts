import { afterEach, describe, expect, it, vi } from 'vitest';

const clearDeviceDrafts = vi.fn(async () => undefined);
vi.mock('./draft-store', () => ({ clearDeviceDrafts: () => clearDeviceDrafts() }));

const { signOut } = await import('./auth-client');

afterEach(() => {
  vi.unstubAllGlobals();
  clearDeviceDrafts.mockClear();
});

describe('signOut (SEC-16)', () => {
  it('ends the session, then clears drafts on this device', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await expect(signOut()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(clearDeviceDrafts).toHaveBeenCalledOnce();
  });

  it('still clears drafts when the api is unreachable or refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await signOut();
    expect(clearDeviceDrafts).toHaveBeenCalledOnce();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    await signOut();
    expect(clearDeviceDrafts).toHaveBeenCalledTimes(2);
  });

  it('resolves even if clearing the drafts fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    clearDeviceDrafts.mockRejectedValueOnce(new Error('blocked'));
    await expect(signOut()).resolves.toBe(true);
  });
});
