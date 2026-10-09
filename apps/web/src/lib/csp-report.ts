import { stripQuery } from '@onetickets/shared';

// /csp-report is unauthenticated, so anything in a report could have been written by anyone.
// Only the fields a real browser sends survive, as short primitives, so the route can't be used
// to put arbitrary text into Sentry (ADR 0003).

// Fields that hold URLs. Their query strings can carry tokens or emails, so only
// scheme://host/path survives, or one of the keywords browsers use instead of a URL.
const URL_FIELDS = new Set(['document-uri', 'referrer', 'blocked-uri', 'source-file']);
const URL_KEYWORDS = new Set(['inline', 'eval', 'data', 'blob', 'self', 'wasm-eval', '']);

const DIRECTIVE_FIELDS = new Set(['violated-directive', 'effective-directive']);
const DIRECTIVES = new Set([
  'default-src',
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'style-src-elem',
  'style-src-attr',
  'img-src',
  'font-src',
  'connect-src',
  'media-src',
  'object-src',
  'frame-src',
  'child-src',
  'worker-src',
  'manifest-src',
  'frame-ancestors',
  'base-uri',
  'form-action',
]);

const NUMBER_FIELDS = new Set(['status-code', 'line-number', 'column-number']);
const DISPOSITIONS = new Set(['enforce', 'report']);

const MAX_STRING = 512;

export const MAX_CSP_REPORT_BYTES = 16 * 1024;

function scrubUrl(value: string): string | null {
  if (URL_KEYWORDS.has(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return url.protocol.slice(0, -1);
    return stripQuery(`${url.origin}${url.pathname}`).slice(0, MAX_STRING);
  } catch {
    return null;
  }
}

// Only the directive name is kept: older browsers append the policy text, which we already know.
function scrubDirective(value: string): string | null {
  const name = value.split(' ', 1)[0] ?? '';
  return DIRECTIVES.has(name) ? name : null;
}

function scrubField(key: string, value: unknown): string | number | null {
  if (NUMBER_FIELDS.has(key)) return Number.isInteger(value) ? (value as number) : null;
  if (typeof value !== 'string') return null;
  if (URL_FIELDS.has(key)) return scrubUrl(value);
  if (DIRECTIVE_FIELDS.has(key)) return scrubDirective(value);
  if (key === 'disposition') return DISPOSITIONS.has(value) ? value : null;
  return null;
}

/**
 * Rebuilds a legacy `report-uri` CSP report ({"csp-report": {...}}) from an allowlist. Returns
 * null for anything that isn't a CSP report with a valid violated directive, so junk posted to
 * the endpoint is dropped rather than forwarded.
 */
export function scrubCspReport(
  body: unknown,
): { 'csp-report': Record<string, string | number> } | null {
  if (typeof body !== 'object' || body === null) return null;
  const report = (body as Record<string, unknown>)['csp-report'];
  if (typeof report !== 'object' || report === null || Array.isArray(report)) return null;

  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(report)) {
    const scrubbed = scrubField(key, value);
    if (scrubbed !== null) out[key] = scrubbed;
  }
  if (!out['violated-directive'] && !out['effective-directive']) return null;
  return { 'csp-report': out };
}
