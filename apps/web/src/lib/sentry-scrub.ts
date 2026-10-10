import { scrubBreadcrumb, scrubEvent, scrubSpan } from '@onetickets/shared';

// Scrubbing lives in @onetickets/shared so the api scrubs identically (ADR 0003).

// One image is promoted from staging to production, so the environment can't be baked in at
// build time. The server reads APP_ENV (set per ECS task); the browser works it out from the
// hostname it was served on.
export function serverEnvironment(env = process.env.APP_ENV): string {
  return env || 'development';
}

export function browserEnvironment(hostname: string): string {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'development';
  if (/(^|\.)staging\./.test(hostname) || hostname.startsWith('staging')) return 'staging';
  if (/(^|\.)dev\./.test(hostname) || hostname.startsWith('dev')) return 'dev';
  return 'production';
}

export function sentryOptions(environment: string) {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // No DSN (local dev, tests, previews) means Sentry stays off.
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment,
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
