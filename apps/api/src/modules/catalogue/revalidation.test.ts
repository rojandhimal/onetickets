import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { NoRevalidation, revalidatorFromEnv, WebRevalidator } from './revalidation.js';

const SECRET = 'a'.repeat(32);

describe('revalidation signal', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
    server = undefined;
  });

  /** A stand-in web app that records each request and answers with `status` (or never). */
  async function web(status: number | 'hang') {
    const seen: { request: IncomingMessage; body: string }[] = [];
    server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        seen.push({ request, body });
        if (status !== 'hang') response.writeHead(status).end();
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return { seen, url: `http://127.0.0.1:${port}` };
  }

  it('posts the slug to the web app with the shared secret', async () => {
    const { seen, url } = await web(204);
    const revalidator = new WebRevalidator(new URL('/internal/revalidate', url), SECRET);
    expect(await revalidator.send('pottery-night-0abc123')).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.request.method).toBe('POST');
    expect(seen[0]!.request.url).toBe('/internal/revalidate');
    expect(seen[0]!.request.headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(seen[0]!.request.headers['content-type']).toBe('application/json');
    expect(JSON.parse(seen[0]!.body)).toEqual({ slugs: ['pottery-night-0abc123'] });
  });

  it('never throws when the web app refuses, hangs or is down', async () => {
    const refused = await web(401);
    expect(await new WebRevalidator(new URL(refused.url), SECRET).send('a')).toBe(false);
    await new Promise((resolve) => server!.close(resolve));

    const hanging = await web('hang');
    server!.closeAllConnections();
    const slow = new WebRevalidator(new URL(hanging.url), SECRET, 50);
    expect(await slow.send('a')).toBe(false);
    server!.closeAllConnections();
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;

    expect(await new WebRevalidator(new URL(hanging.url), SECRET, 500).send('a')).toBe(false);
  });

  it('is off without a secret and refuses a short one', () => {
    expect(revalidatorFromEnv({})).toBeInstanceOf(NoRevalidation);
    expect(() =>
      revalidatorFromEnv({ REVALIDATE_SECRET: 'short', WEB_URL: 'https://example.test' }),
    ).toThrow(/at least 32/);
    expect(() => revalidatorFromEnv({ REVALIDATE_SECRET: SECRET })).toThrow(/WEB_URL/);
    expect(
      revalidatorFromEnv({ REVALIDATE_SECRET: SECRET, WEB_URL: 'https://example.test' }),
    ).toBeInstanceOf(WebRevalidator);
  });
});
