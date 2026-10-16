import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

describe('event page proxy', () => {
  it('enforces a fresh nonce CSP that no shared cache may keep', () => {
    const first = proxy(new NextRequest('http://localhost/e/screen-printing'));
    const second = proxy(new NextRequest('http://localhost/e/screen-printing'));
    const csp = first.headers.get('content-security-policy') ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("form-action 'self'");
    expect(second.headers.get('content-security-policy')).not.toBe(csp);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
  });

  it('only runs on event pages', () => {
    expect(config.matcher.map((m) => m.source)).toEqual(['/e/:slug']);
  });

  it('skips only router prefetches, so browser document prefetches get the policy', () => {
    expect(config.matcher[0]!.missing).toEqual([{ type: 'header', key: 'next-router-prefetch' }]);
  });
});
