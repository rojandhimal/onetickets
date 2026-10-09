import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const report = {
  'csp-report': {
    'document-uri':
      'https://onetickets.au/signup?token=SECRETQUERYTOKEN&email=priya%40example.test',
    referrer: 'https://mail.example.test/inbox?session=abc',
    'blocked-uri': 'https://evil.example/x.js?u=priya@example.test',
    'violated-directive': 'script-src',
    'script-sample': 'priya@example.test',
    'original-policy': "default-src 'self'",
  },
};

function post(body: string, headers: Record<string, string> = {}) {
  return POST(
    new Request('http://localhost:3000/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report', 'user-agent': 'UA/1', ...headers },
      body,
    }),
  );
}

describe('POST /csp-report', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://abc123@o42.ingest.sentry.io/4507');
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it('forwards a scrubbed report to Sentry', async () => {
    const res = await post(JSON.stringify(report));
    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://o42.ingest.sentry.io/api/4507/security/?sentry_key=abc123');
    expect(new Headers(init.headers).get('user-agent')).toBe('UA/1');
    const sent = String(init.body);
    for (const leak of ['SECRETQUERYTOKEN', 'priya', 'session=abc', '?u=']) {
      expect(sent).not.toContain(leak);
    }
    expect(JSON.parse(sent)['csp-report']).toEqual({
      'document-uri': 'https://onetickets.au/signup',
      referrer: 'https://mail.example.test/inbox',
      'blocked-uri': 'https://evil.example/x.js',
      'violated-directive': 'script-src',
      'original-policy': "default-src 'self'",
    });
  });

  it('drops junk and oversized bodies without forwarding', async () => {
    expect((await post('not json')).status).toBe(204);
    expect((await post(JSON.stringify({ hello: 'world' }))).status).toBe(204);
    expect((await post(JSON.stringify({ 'csp-report': { x: 'y'.repeat(20_000) } }))).status).toBe(
      204,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caps a streamed body with no content-length', async () => {
    const big = new TextEncoder().encode('x'.repeat(4096));
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 100) controller.close();
        else controller.enqueue(big);
      },
    });
    const res = await POST(
      // duplex is required by Node for a streamed body but missing from the DOM RequestInit type.
      new Request('http://localhost:3000/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/csp-report' },
        body,
        duplex: 'half',
      } as RequestInit),
    );
    expect(res.status).toBe(204);
    expect(sent).toBeLessThan(10);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up on Sentry after a timeout', async () => {
    await post(JSON.stringify(report));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps only known fields, as short primitives', async () => {
    await post(
      JSON.stringify({
        'csp-report': {
          'violated-directive': 'script-src',
          'effective-directive': 'URGENT: rotate keys at https://evil.example',
          'document-uri': 'https://onetickets.au/' + 'a'.repeat(2000),
          'blocked-uri': 'javascript:alert(1)',
          'line-number': 12,
          'column-number': '7',
          disposition: 'report',
          anything: 'phishing text',
          nested: { 'document-uri': 'https://x.test' },
        },
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body))['csp-report'];
    expect(Object.keys(sent).sort()).toEqual([
      'blocked-uri',
      'disposition',
      'document-uri',
      'line-number',
      'violated-directive',
    ]);
    expect(sent['document-uri'].length).toBeLessThanOrEqual(512);
    expect(sent['blocked-uri']).toBe('javascript');
  });

  it('drops reports without a known directive and other content types', async () => {
    await post(JSON.stringify({ 'csp-report': { 'violated-directive': 'URGENT rotate keys' } }));
    await post(JSON.stringify(report), { 'content-type': 'text/plain' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing without a DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    expect((await post(JSON.stringify(report))).status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still answers 204 when Sentry is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect((await post(JSON.stringify(report))).status).toBe(204);
  });
});
