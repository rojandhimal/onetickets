import type { NodeOptions } from '@sentry/nestjs';
import { scrubBreadcrumb, scrubEvent, scrubSpan } from '@onetickets/shared';

/**
 * Sentry for the api: errors plus traces (Sentry's SDK is OpenTelemetry underneath, so the trace
 * continues from the web app's request and covers Express, Nest and every Postgres query).
 * Off without SENTRY_DSN. Everything sent runs through the same scrubbers as the web app
 * (@onetickets/shared, ADR 0003): no bodies, cookies, headers, query strings or personal data.
 */
export function sentryOptions(env: NodeJS.ProcessEnv = process.env): NodeOptions {
  return {
    dsn: env.SENTRY_DSN,
    enabled: Boolean(env.SENTRY_DSN),
    environment: env.APP_ENV || 'development',
    release: env.SENTRY_RELEASE || undefined,
    tracesSampleRate: sampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    // Trace headers stay inside OneTickets: none on calls to Google, SES or anything else.
    tracePropagationTargets: [],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
    beforeSendSpan: (span) => scrubSpan(span),
  };
}

function sampleRate(value: string | undefined): number {
  const rate = Number(value ?? '0.1');
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.1;
}
