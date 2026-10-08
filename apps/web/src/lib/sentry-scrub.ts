import { redact, redactString, stripQuery } from '@onetickets/shared';
import type { Breadcrumb, BrowserOptions, Event } from '@sentry/nextjs';

type StreamedSpan = Parameters<NonNullable<BrowserOptions['beforeSendSpan']>>[0];

// Threat model section 6: no bodies, cookies, query strings, tokens or personal data reach
// Sentry. Every runtime (browser, Node, edge) runs events through these before sending.

export function scrubEvent<E extends Event>(event: E): E {
  const out = redact(event);
  if (out.request) {
    const { url, method } = out.request;
    out.request = { method, url: url ? stripQuery(url) : url };
  }
  if (out.user) out.user = out.user.id ? { id: out.user.id } : {};
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  if (out.transaction) out.transaction = stripQuery(out.transaction);
  return out;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const out = redact(crumb);
  const data = out.data;
  if (data) {
    for (const key of ['url', 'from', 'to'] as const) {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key]);
    }
  }
  if (out.message) out.message = redactString(out.message);
  return out;
}

// Span attributes that can carry who the user is or where they connect from.
const DROP_SPAN_ATTRIBUTE = /^(user\.|client\.address|network\.peer\.address|http\.client_ip)/;
const URL_ATTRIBUTE = /(url|target|route|path)/i;

export function scrubSpan(span: StreamedSpan): StreamedSpan {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(span.attributes ?? {})) {
    if (DROP_SPAN_ATTRIBUTE.test(key) || key.endsWith('.query')) continue;
    attributes[key] =
      typeof value === 'string' && URL_ATTRIBUTE.test(key) ? stripQuery(value) : value;
  }
  return {
    ...span,
    name: redactString(stripQuery(span.name)),
    attributes: redact(attributes) as StreamedSpan['attributes'],
  };
}

export function sentryOptions() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // No DSN (local dev, tests, previews) means Sentry stays off.
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii: false,
    // Collect nothing about the person or their requests beyond what the scrubbers let through.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: scrubEvent,
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
