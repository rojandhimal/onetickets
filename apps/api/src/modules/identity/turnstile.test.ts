import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTurnstileSecret, SITEVERIFY_URL, Turnstile } from './turnstile.js';

// Cloudflare's documented always-pass test secret.
const TEST_SECRET = '1x0000000000000000000000000000000AA';

const answer = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('loadTurnstileSecret', () => {
  it('is off unless TURNSTILE_ENABLED is exactly true', () => {
    expect(loadTurnstileSecret({})).toBeNull();
    expect(loadTurnstileSecret({ TURNSTILE_ENABLED: '1', TURNSTILE_SECRET_KEY: 'x' })).toBeNull();
  });

  it('needs a secret when on', () => {
    expect(() => loadTurnstileSecret({ TURNSTILE_ENABLED: 'true' })).toThrow(
      'TURNSTILE_SECRET_KEY',
    );
  });

  it("refuses Cloudflare's test secrets in production", () => {
    const env = { TURNSTILE_ENABLED: 'true', TURNSTILE_SECRET_KEY: TEST_SECRET };
    expect(loadTurnstileSecret(env)).toBe(TEST_SECRET);
    expect(() => loadTurnstileSecret({ ...env, NODE_ENV: 'production' })).toThrow('test keys');
  });
});

describe('Turnstile.verify', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes everything without a call when off', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const turnstile = new Turnstile(null, fetchFn);
    expect(turnstile.enabled).toBe(false);
    expect(await turnstile.verify(undefined)).toBe('passed');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fails a missing token without asking Cloudflare', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    expect(await new Turnstile(TEST_SECRET, fetchFn).verify(undefined)).toBe('failed');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends the secret and token, and nothing else, to siteverify', async () => {
    const fetchFn = answer(200, { success: true });
    expect(await new Turnstile(TEST_SECRET, fetchFn).verify('tok')).toBe('passed');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(SITEVERIFY_URL);
    expect(init?.method).toBe('POST');
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      secret: TEST_SECRET,
      response: 'tok',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails a token Cloudflare rejects', async () => {
    const fetchFn = answer(200, { success: false, 'error-codes': ['invalid-input-response'] });
    expect(await new Turnstile(TEST_SECRET, fetchFn).verify('tok')).toBe('failed');
  });

  it.each([
    ['a 5xx', answer(502, {})],
    [
      "Cloudflare's internal error",
      answer(200, { success: false, 'error-codes': ['internal-error'] }),
    ],
    ['a body that is not JSON', vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>'))],
    ['a network error', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))],
    [
      'a timeout',
      vi.fn<typeof fetch>().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    ],
  ])('is unavailable on %s, and logs it without the token or secret', async (_, fetchFn) => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    expect(await new Turnstile(TEST_SECRET, fetchFn).verify('secret-token')).toBe('unavailable');
    expect(warn).toHaveBeenCalledOnce();
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain(TEST_SECRET);
  });
});
