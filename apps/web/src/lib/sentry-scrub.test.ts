import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import {
  browserEnvironment,
  scrubBreadcrumb,
  scrubEvent,
  scrubSpan,
  sentryOptions,
  serverEnvironment,
} from './sentry-scrub';

const event: ErrorEvent = {
  type: undefined,
  message: 'Sign-up failed for priya@printshed.com.au',
  request: {
    url: 'https://app.onetickets.au/auth/verify?x=1#token=abc123',
    method: 'POST',
    data: { email: 'priya@printshed.com.au', organiserName: 'The Print Shed' },
    cookies: { ot_session: 's3cr3t' },
    headers: { cookie: 'ot_session=s3cr3t', 'user-agent': 'x' },
    query_string: 'token=abc123',
  },
  user: { id: 'usr_7', email: 'priya@printshed.com.au', ip_address: '203.0.113.9' },
  tags: { organisation_id: 'org_42' },
  extra: { session: { user: { email: 'priya@printshed.com.au', name: 'Priya' } } },
  breadcrumbs: [
    {
      category: 'fetch',
      data: { url: '/api/auth/magic-link?email=priya@printshed.com.au', method: 'POST' },
    },
    {
      category: 'navigation',
      data: { from: '/signup?error=google', to: '/auth/verify#token=abc123' },
    },
  ],
  exception: { values: [{ type: 'Error', value: 'POST failed: Bearer eyJabc.def.ghi' }] },
};

describe('scrubEvent', () => {
  const out = scrubEvent(event);
  const text = JSON.stringify(out);

  it('removes bodies, cookies, headers, query strings and personal data', () => {
    for (const leak of [
      'priya@',
      'Priya',
      'Print Shed',
      's3cr3t',
      'abc123',
      'eyJabc',
      '203.0.113.9',
      '?x=1',
    ]) {
      expect(text).not.toContain(leak);
    }
    expect(out.request).toEqual({ method: 'POST', url: 'https://app.onetickets.au/auth/verify' });
  });

  it('keeps the ids that make errors useful', () => {
    expect(out.user).toEqual({ id: 'usr_7' });
    expect(out.tags).toEqual({ organisation_id: 'org_42' });
  });
});

describe('scrubBreadcrumb', () => {
  it('strips query strings from urls', () => {
    const crumb: Breadcrumb = {
      category: 'xhr',
      data: { url: '/api/me?debug=1', status_code: 200 },
    };
    expect(scrubBreadcrumb(crumb).data).toEqual({ url: '/api/me', status_code: 200 });
  });
});

describe('scrubSpan', () => {
  it('drops client addresses and strips query strings and tokens', () => {
    const out = scrubSpan({
      trace_id: 't',
      span_id: 's',
      name: 'GET /auth/verify?token=abc123',
      start_timestamp: 0,
      status: 'ok',
      is_segment: true,
      attributes: {
        'url.full': 'https://app.onetickets.au/signup?email=priya@printshed.com.au',
        'url.query': 'email=priya@printshed.com.au',
        'network.peer.address': '203.0.113.9',
        'user.email': 'priya@printshed.com.au',
        'http.request.method': 'GET',
        organisation_id: 'org_42',
      },
    });
    expect(out.name).toBe('GET /auth/verify');
    expect(out.attributes).toEqual({
      'url.full': 'https://app.onetickets.au/signup',
      'http.request.method': 'GET',
      organisation_id: 'org_42',
    });
  });
});

describe('sentryOptions', () => {
  it('stays off without a DSN and never sends default PII', () => {
    const options = sentryOptions('development');
    expect(options.enabled).toBe(false);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.dataCollection.userInfo).toBe(false);
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
