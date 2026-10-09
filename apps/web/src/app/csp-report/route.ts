import { MAX_CSP_REPORT_BYTES, scrubCspReport } from '@/lib/csp-report';
import { cspReportUri } from '@/lib/security-headers';

const FORWARD_TIMEOUT_MS = 2000;

// The route is unauthenticated, so cap what one instance forwards to Sentry. Cloudflare rate
// limits it per client in front of this (SEC-10); this keeps a flood from using up Sentry's quota.
const MAX_FORWARDS_PER_MINUTE = 60;
let windowStart = 0;
let forwardsInWindow = 0;

function takeForwardSlot(now = Date.now()): boolean {
  if (now - windowStart >= 60_000) {
    windowStart = now;
    forwardsInWindow = 0;
  }
  forwardsInWindow += 1;
  return forwardsInWindow <= MAX_FORWARDS_PER_MINUTE;
}

// Reads the body but stops at `max` bytes, so a chunked request with no content-length can't make
// us buffer an unbounded body. Returns null when the body is too big.
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Browsers post CSP violation reports here instead of straight to Sentry, so the in-app scrubber
// sees them (ADR 0003). Forwarding from the server also keeps the reporter's IP out of Sentry.
export async function POST(request: Request): Promise<Response> {
  const done = new Response(null, { status: 204 });
  const target = cspReportUri();
  if (!target) return done;

  const type = (request.headers.get('content-type') ?? '').split(';', 1)[0]?.trim();
  if (type !== 'application/csp-report' && type !== 'application/json') return done;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_CSP_REPORT_BYTES) return done;
  const text = await readCapped(request, MAX_CSP_REPORT_BYTES);
  if (text === null) return done;

  let report;
  try {
    report = scrubCspReport(JSON.parse(text));
  } catch {
    return done;
  }
  if (!report || !takeForwardSlot()) return done;

  try {
    await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        // Sentry reads the browser and OS from this; it is not personal on its own.
        'user-agent': (request.headers.get('user-agent') ?? '').slice(0, 256),
      },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch {
    // Reports are best effort. A Sentry outage must not turn into errors for the browser.
  }
  return done;
}
