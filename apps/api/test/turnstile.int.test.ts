import 'reflect-metadata';
import { randomInt } from 'node:crypto';
import { Logger, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureTrustProxy } from '../src/http.js';
import { Mailer, OutboxMailer } from '../src/modules/notifications/index.js';
import { Turnstile } from '../src/modules/identity/turnstile.js';
import { uniqueEmail } from './db.js';

const WEB = 'http://localhost:3000';
// A fresh client address per call, so the per-IP limit stays out of the way unless a test means it.
const anyIp = () => `2001:db8:5ec:10::${randomInt(1, 0xffff).toString(16)}`;

// Turnstile on (SEC-10), with siteverify stood in for: Cloudflare isn't reachable from tests.
describe('Turnstile on magic-link requests', () => {
  let app: INestApplication;
  let outbox: OutboxMailer;
  const siteverify = vi.fn<typeof fetch>();

  const accept = () => siteverify.mockImplementation(async () => Response.json({ success: true }));
  const reject = () =>
    siteverify.mockImplementation(async () =>
      Response.json({ success: false, 'error-codes': ['invalid-input-response'] }),
    );

  const send = (body: object, ip = anyIp()) =>
    request(app.getHttpServer())
      .post('/auth/magic-link')
      .set({ origin: WEB, 'x-forwarded-for': ip })
      .send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Turnstile)
      .useValue(new Turnstile('1x0000000000000000000000000000000AA', siteverify))
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureTrustProxy(app as NestExpressApplication, { TRUST_PROXY_HOPS: '1' });
    await app.init();
    outbox = app.get(Mailer) as OutboxMailer;
  });

  beforeEach(() => {
    siteverify.mockReset();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('sends the link once Cloudflare passes the token', async () => {
    accept();
    const email = uniqueEmail('turnstile-pass');
    await send({ email, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }).expect(202);
    expect(outbox.lastTo(email)).toBeDefined();
    const body = siteverify.mock.calls[0]![1]!.body as URLSearchParams;
    expect(body.get('response')).toBe('XXXX.DUMMY.TOKEN.XXXX');
  });

  it('refuses a request without a token, without asking Cloudflare or sending a link', async () => {
    const email = uniqueEmail('turnstile-missing');
    const res = await send({ email }).expect(403);
    expect(res.body.code).toBe('challenge_failed');
    expect(siteverify).not.toHaveBeenCalled();
    expect(outbox.lastTo(email)).toBeUndefined();
  });

  it('refuses a token Cloudflare rejects, and sends no link', async () => {
    reject();
    const email = uniqueEmail('turnstile-reject');
    const res = await send({ email, turnstileToken: 'forged' }).expect(403);
    expect(res.body.code).toBe('challenge_failed');
    expect(outbox.lastTo(email)).toBeUndefined();
  });

  it('fails closed when Cloudflare cannot be reached', async () => {
    siteverify.mockRejectedValue(new TypeError('fetch failed'));
    const email = uniqueEmail('turnstile-down');
    const res = await send({ email, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }).expect(503);
    expect(res.body.code).toBe('challenge_unavailable');
    expect(outbox.lastTo(email)).toBeUndefined();
  });

  it("doesn't let failed checks use up someone's sign-in links", async () => {
    reject();
    const email = uniqueEmail('turnstile-victim');
    // More than the 5-per-email limit, each from a different address.
    for (let i = 0; i < 6; i++) await send({ email, turnstileToken: 'forged' }).expect(403);
    accept();
    await send({ email, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }).expect(202);
    expect(outbox.lastTo(email)).toBeDefined();
  });

  it('still limits each address before asking Cloudflare', async () => {
    reject();
    const ip = anyIp();
    for (let i = 0; i < 30; i++) {
      await send({ email: uniqueEmail('turnstile-flood'), turnstileToken: 'x' }, ip).expect(403);
    }
    siteverify.mockClear();
    const res = await send({ email: uniqueEmail('turnstile-flood'), turnstileToken: 'x' }, ip);
    expect(res.status).toBe(429);
    expect(siteverify).not.toHaveBeenCalled();
  });
});
