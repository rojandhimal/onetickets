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

/** Where Cloudflare Turnstile's script and challenge frame come from (SEC-10). */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

const csp = [
  "default-src 'self'",
  // Turnstile (SEC-10) is listed everywhere here: this policy only reports, and its paths can't
  // vary at run time. The enforced policy (strictSiteCsp) allows it only on the sign-in pages.
  `script-src 'self' 'unsafe-inline' ${TURNSTILE_ORIGIN}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${sentryOrigin()}`,
  `frame-src ${TURNSTILE_ORIGIN}`,
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

/**
 * Enforced site-wide CSP (SEC-14, ADR 0018). Scripts need this request's nonce; Next adds it to
 * its own scripts when it sees the nonce in the request's CSP header. Styles stay 'unsafe-inline'
 * for React style attributes such as the banner focal point: style injection can't run code.
 */
export function strictSiteCsp(
  nonce: string,
  opts: { dev?: boolean; turnstile?: boolean } = {},
): string {
  // The Turnstile widget (SEC-10): its script, which our own trusted code inserts, and the
  // challenge frame. Hosts in script-src are for browsers without 'strict-dynamic'.
  const turnstile = opts.turnstile ? ` ${TURNSTILE_ORIGIN}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${turnstile}${opts.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${sentryOrigin()}`,
    ...(opts.turnstile ? [`frame-src ${TURNSTILE_ORIGIN}`] : []),
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    ...(cspReportUri() ? [`report-uri ${CSP_REPORT_PATH}`] : []),
  ].join('; ');
}

/** Legacy alias for backwards compatibility with earlier stories and ADR 0018. */
export const strictEventPageCsp = strictSiteCsp;
