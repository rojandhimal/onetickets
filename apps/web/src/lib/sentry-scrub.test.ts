import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { browserEnvironment, sentryOptions, serverEnvironment } from './sentry-scrub';

describe('sentryOptions', () => {
  it('stays off without a DSN and never sends default PII', () => {
    const options = sentryOptions('development');
    expect(options.enabled).toBe(false);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.dataCollection.userInfo).toBe(false);
  });

  it('scrubs every event with the shared scrubber', () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { url: '/auth/verify?x=1', method: 'POST', cookies: { ot_session: 's3cr3t' } },
      user: { id: 'usr_7', email: 'priya@printshed.com.au' },
      sdk: { name: 'sentry.javascript.nextjs', version: '11.6.0' },
    };
    const out = sentryOptions('development').beforeSend(event);
    expect(out.request).toEqual({ method: 'POST', url: '/auth/verify' });
    expect(out.user).toEqual({ id: 'usr_7' });
    expect(out.sdk?.name).toBe('sentry.javascript.nextjs');
  });
});

describe('environment', () => {
  it('comes from APP_ENV on the server', () => {
    expect(serverEnvironment('staging')).toBe('staging');
    expect(serverEnvironment(undefined)).toBe('development');
  });
  it('comes from the hostname in the browser', () => {
    expect(browserEnvironment('localhost')).toBe('development');
    expect(browserEnvironment('staging.onetickets.au')).toBe('staging');
    expect(browserEnvironment('app.staging.onetickets.au')).toBe('staging');
    expect(browserEnvironment('onetickets.au')).toBe('production');
    expect(browserEnvironment('www.onetickets.au')).toBe('production');
  });
});
