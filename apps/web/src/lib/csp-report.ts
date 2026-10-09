import { redact, stripQuery } from '@onetickets/shared';

// Fields of a CSP violation report that hold URLs. Their query strings can carry tokens or
// emails (an invite or unsubscribe link, say), so only the path survives.
const URL_FIELDS = ['document-uri', 'referrer', 'blocked-uri', 'source-file'];

// Fields that can hold page content rather than describe the violation.
const DROPPED_FIELDS = ['script-sample'];

export const MAX_CSP_REPORT_BYTES = 16 * 1024;

/**
 * Scrubs a legacy `report-uri` CSP report ({"csp-report": {...}}). Returns null for anything
 * else, so junk posted to the endpoint is dropped rather than forwarded.
 */
export function scrubCspReport(body: unknown): { 'csp-report': Record<string, unknown> } | null {
  if (typeof body !== 'object' || body === null) return null;
  const report = (body as Record<string, unknown>)['csp-report'];
  if (typeof report !== 'object' || report === null || Array.isArray(report)) return null;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(report)) {
    if (DROPPED_FIELDS.includes(key)) continue;
    out[key] = URL_FIELDS.includes(key) && typeof value === 'string' ? stripQuery(value) : value;
  }
  return { 'csp-report': redact(out) };
}
