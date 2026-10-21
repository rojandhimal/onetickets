import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

describe('site-wide proxy (SEC-14)', () => {
  it('enforces a fresh nonce CSP that no shared cache may keep on event pages', () => {
    const first = proxy(new NextRequest('http://localhost/e/screen-printing'));
    const second = proxy(new NextRequest('http://localhost/e/screen-printing'));
    const csp = first.headers.get('content-security-policy') ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("form-action 'self'");
    expect(second.headers.get('content-security-policy')).not.toBe(csp);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
  });

  it('enforces a fresh nonce CSP on the root and other pages', () => {
    const res = proxy(new NextRequest('http://localhost/'));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('matches all page routes and excludes api, static assets, and images', () => {
    const pattern = new RegExp(
      '^' + config.matcher[0]!.source.replace(/:slug/g, '[^/]+').replace(/:path\*/g, '.*'),
    );
    expect(pattern.test('/e/my-event')).toBe(true);
    expect(pattern.test('/')).toBe(true);
    expect(pattern.test('/signin')).toBe(true);
    expect(pattern.test('/browse')).toBe(true);
    expect(pattern.test('/organiser/events/new')).toBe(true);
    expect(pattern.test('/api/v1/events')).toBe(false);
    expect(pattern.test('/_next/static/chunks/main.js')).toBe(false);
    expect(pattern.test('/favicon.ico')).toBe(false);
    expect(pattern.test('/csp-report')).toBe(false);
    expect(pattern.test('/internal/revalidate')).toBe(false);
    expect(pattern.test('/banner.png')).toBe(false);
    expect(pattern.test('/icon.svg')).toBe(false);
  });

  it('skips only router prefetches, so browser document prefetches get the policy', () => {
    expect(config.matcher[0]!.missing).toEqual([{ type: 'header', key: 'next-router-prefetch' }]);
  });
});
