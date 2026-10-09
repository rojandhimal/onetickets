import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { cspReportUri } from './security-headers';

async function headersFor(path: string) {
  const rules = (await nextConfig.headers?.()) ?? [];
  // Later rules win, matching how Next applies duplicate keys.
  const out = new Map<string, string>();
  for (const rule of rules) {
    const matches = rule.source === '/:path*' || rule.source === path;
    if (matches) for (const h of rule.headers) out.set(h.key, h.value);
  }
  return out;
}

describe('security headers', () => {
  it('sets the baseline on every page', async () => {
    const h = await headersFor('/signup');
    expect(h.get('X-Content-Type-Options')).toBe('nosniff');
    expect(h.get('X-Frame-Options')).toBe('DENY');
    expect(h.get('Strict-Transport-Security')).toMatch(/max-age=\d+/);
    expect(h.get('Content-Security-Policy-Report-Only')).toContain("frame-ancestors 'none'");
    expect(h.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sends no referrer from the magic-link landing page', async () => {
    expect((await headersFor('/auth/verify')).get('Referrer-Policy')).toBe('no-referrer');
  });
});

describe('cspReportUri', () => {
  it('points CSP reports at the Sentry project from the DSN', () => {
    expect(cspReportUri(new URL('https://abc123@o42.ingest.sentry.io/4507'))).toBe(
      'https://o42.ingest.sentry.io/api/4507/security/?sentry_key=abc123',
    );
  });
  it('is off without a DSN', () => {
    expect(cspReportUri(null)).toBeNull();
  });
});
