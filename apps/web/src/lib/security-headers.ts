type Header = { key: string; value: string };

// Report-only for now: Next's inline bootstrap scripts need nonces before we can enforce.
// Switch to Content-Security-Policy once the reports are clean (threat model T8, T10).
// Browser errors go straight to Sentry's ingest host, so it has to be allowed to connect.
function sentryOrigin(): string {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return '';
  try {
    return ` ${new URL(dsn).origin}`;
  } catch {
    return '';
  }
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${sentryOrigin()}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export const securityHeaders: Header[] = [
  { key: 'Content-Security-Policy-Report-Only', value: csp },
  // Enforced now, since CSP frame-ancestors is report-only above.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** The magic-link landing page must never leak its URL to anything it loads or links to. */
export const verifyPageHeaders: Header[] = [{ key: 'Referrer-Policy', value: 'no-referrer' }];
