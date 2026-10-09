import { MAX_CSP_REPORT_BYTES, scrubCspReport } from '@/lib/csp-report';
import { cspReportUri } from '@/lib/security-headers';

// Browsers post CSP violation reports here instead of straight to Sentry, so the in-app scrubber
// sees them (ADR 0003). Forwarding from the server also keeps the reporter's IP out of Sentry.
export async function POST(request: Request): Promise<Response> {
  const done = new Response(null, { status: 204 });
  const target = cspReportUri();
  if (!target) return done;

  if (Number(request.headers.get('content-length') ?? 0) > MAX_CSP_REPORT_BYTES) return done;
  const text = await request.text();
  if (text.length > MAX_CSP_REPORT_BYTES) return done;

  let report;
  try {
    report = scrubCspReport(JSON.parse(text));
  } catch {
    return done;
  }
  if (!report) return done;

  try {
    await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        // Sentry reads the browser and OS from this; it is not personal on its own.
        'user-agent': request.headers.get('user-agent') ?? '',
      },
      body: JSON.stringify(report),
    });
  } catch {
    // Reports are best effort. A Sentry outage must not turn into errors for the browser.
  }
  return done;
}
