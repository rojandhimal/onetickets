import { afterEach, describe, expect, it, vi } from 'vitest';

const clearDeviceDrafts = vi.fn(async () => undefined);
vi.mock('./draft-store', () => ({ clearDeviceDrafts: () => clearDeviceDrafts() }));

const { requestMagicLink, signOut } = await import('./auth-client');

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

describe('requestMagicLink with Turnstile (SEC-10)', () => {
  const answer = (status: number, body?: object) =>
    vi.fn(async () => new Response(body ? JSON.stringify(body) : null, { status }));

  it('sends the token with the email, and leaves it out when there is none', async () => {
    const fetch = answer(202);
    vi.stubGlobal('fetch', fetch);
    await expect(requestMagicLink('mei@example.test', 'tok')).resolves.toEqual({ ok: true });
    await requestMagicLink('mei@example.test');
    const bodies = fetch.mock.calls.map((call) => (call as unknown[])[1] as RequestInit);
    expect(JSON.parse(bodies[0]!.body as string)).toEqual({
      email: 'mei@example.test',
      turnstileToken: 'tok',
    });
    expect(JSON.parse(bodies[1]!.body as string)).toEqual({ email: 'mei@example.test' });
  });

  it('tells a failed check from Cloudflare being unreachable', async () => {
    vi.stubGlobal('fetch', answer(403, { statusCode: 403, code: 'challenge_failed', message: '' }));
    await expect(requestMagicLink('mei@example.test', 'tok')).resolves.toEqual({
      ok: false,
      kind: 'challenge',
    });
    vi.stubGlobal(
      'fetch',
      answer(503, { statusCode: 503, code: 'challenge_unavailable', message: '' }),
    );
    await expect(requestMagicLink('mei@example.test', 'tok')).resolves.toEqual({
      ok: false,
      kind: 'unavailable',
    });
    // Any other 503 is the usual "check your connection".
    vi.stubGlobal('fetch', answer(503));
    await expect(requestMagicLink('mei@example.test', 'tok')).resolves.toEqual({
      ok: false,
      kind: 'failed',
    });
  });
});
