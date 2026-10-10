import type { ErrorEvent } from '@sentry/nestjs';
import { describe, expect, it } from 'vitest';
import { leaks, PII } from './pii-sample.js';
import { sentryOptions } from './sentry.js';

describe('api Sentry options', () => {
  it('stays off without a DSN and collects no user info, cookies or headers', () => {
    const options = sentryOptions({});
    expect(options.enabled).toBe(false);
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
    });
  });

  it('tags environment and release', () => {
    const options = sentryOptions({
      SENTRY_DSN: 'https://k@o.ingest.sentry.io/1',
      APP_ENV: 'staging',
      SENTRY_RELEASE: 'abc123',
    });
    expect(options).toMatchObject({ enabled: true, environment: 'staging', release: 'abc123' });
  });

  it('scrubs a known PII sample out of an error event', () => {
    const event = {
      message: `Failed for ${PII.email}`,
      request: {
        method: 'POST',
        url: `https://onetickets.com.au/api/auth/verify?token=${PII.token}`,
        headers: { cookie: PII.cookie, authorization: PII.authorization },
        data: { email: PII.email, organiserName: PII.name },
      },
      user: { id: 'user-1', email: PII.email, ip_address: PII.ip },
      extra: { phone: PII.phone },
      breadcrumbs: [
        { message: `GET /api/me?token=${PII.token}`, data: { url: `/x?code=${PII.token}` } },
      ],
    } as unknown as ErrorEvent;
    const sent = sentryOptions({}).beforeSend!(event, {});
    expect(leaks(JSON.stringify(sent))).toEqual([]);
    expect(JSON.stringify(sent)).toContain('user-1');
  });

  it('scrubs a span name and attributes', () => {
    const span = {
      name: `GET /api/auth/verify?token=${PII.token}`,
      attributes: {
        'http.url': `https://x/api?code=${PII.token}`,
        'client.address': PII.ip,
        'user.email': PII.email,
      },
    };
    const sent = sentryOptions({}).beforeSendSpan!(span as never);
    expect(leaks(JSON.stringify(sent))).toEqual([]);
  });
});
