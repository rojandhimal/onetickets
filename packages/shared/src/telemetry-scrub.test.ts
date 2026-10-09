import { describe, expect, it } from 'vitest';
import { REDACTED } from './redact.js';
import { scrubBreadcrumb, scrubEvent, scrubSpan } from './telemetry-scrub.js';

const event = {
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
    const crumb = {
      category: 'xhr',
      data: { url: '/api/me?debug=1', status_code: 200 },
    };
    expect(scrubBreadcrumb(crumb).data).toEqual({ url: '/api/me', status_code: 200 });
  });
});

describe('scrubSpan', () => {
  it('drops client addresses and strips query strings and tokens', () => {
    const out = scrubSpan({
      name: 'GET /auth/verify?token=abc123',
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

describe('descriptive fields', () => {
  it('keeps the SDK and browser, OS and runtime names but not the device name', () => {
    const out = scrubEvent({
      sdk: { name: 'sentry.javascript.nextjs', version: '11.6.0' },
      contexts: {
        browser: { name: 'Chrome', version: '141' },
        os: { name: 'iOS', version: '19' },
        runtime: { name: 'node', version: '22' },
        device: { name: "Priya's iPhone", family: 'iPhone' },
        app: { session_token: 'abc' },
      },
    });
    expect(out.sdk).toEqual({ name: 'sentry.javascript.nextjs', version: '11.6.0' });
    expect(out.contexts?.browser).toEqual({ name: 'Chrome', version: '141' });
    expect(out.contexts?.os).toEqual({ name: 'iOS', version: '19' });
    expect(out.contexts?.runtime).toEqual({ name: 'node', version: '22' });
    expect(out.contexts?.device).toEqual({ name: REDACTED, family: 'iPhone' });
    expect(out.contexts?.app).toEqual({ session_token: REDACTED });
  });
});
