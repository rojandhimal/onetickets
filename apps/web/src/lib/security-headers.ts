type Header = { key: string; value: string };

// Report-only for now: Next's inline bootstrap scripts need nonces before we can enforce.
// Switch to Content-Security-Policy once the reports are clean (threat model T8, T10).
function parseDsn(): URL | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    return new URL(dsn);
  } catch {
    return null;
  }
}

/** Browser errors go straight to Sentry's ingest host, so it has to be allowed to connect. */
export function sentryOrigin(dsn = parseDsn()): string {
  return dsn ? ` ${dsn.origin}` : '';
}

/**
 * Sentry's security endpoint for CSP violation reports. Browsers don't post here directly: they
 * post to our own /csp-report, which scrubs the report and forwards it (ADR 0003).
 */
export function cspReportUri(dsn = parseDsn()): string | null {
  const projectId = dsn?.pathname.replace(/^\/+/, '');
  if (!dsn || !dsn.username || !projectId) return null;
  return `${dsn.origin}/api/${projectId}/security/?sentry_key=${dsn.username}`;
}

export const CSP_REPORT_PATH = '/csp-report';

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
  ...(cspReportUri() ? [`report-uri ${CSP_REPORT_PATH}`] : []),
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
