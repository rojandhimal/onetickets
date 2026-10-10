import 'reflect-metadata';
import { randomInt } from 'node:crypto';
import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureLogging, configureTrustProxy } from '../src/http.js';
import { Public } from '../src/modules/identity/index.js';
import { Mailer, type OutboxMailer } from '../src/modules/notifications/index.js';
import { leaks, PII } from '../src/observability/pii-sample.js';

const WEB = 'http://localhost:3000';

// A route that fails the way real bugs do: an unhandled error whose message holds personal data.
@Controller()
class ThrowingController {
  @Get('throws')
  @Public()
  throws(): never {
    throw new TypeError(`No account for ${PII.email}`);
  }
}

@Module({ controllers: [ThrowingController] })
class ThrowingModule {}

// QA 5.3 and 5.4: every log line for a request has its request id (and organisation id once
// known), and a request full of personal data leaves none of it in the logs.
describe('api request logs', () => {
  let app: NestExpressApplication;
  let outbox: OutboxMailer;
  const written: string[] = [];

  const logLines = () =>
    written
      .join('')
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeAll(async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ThrowingModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
    configureLogging(app);
    configureTrustProxy(app, { TRUST_PROXY_HOPS: '1' });
    await app.init();
    outbox = app.get(Mailer) as OutboxMailer;
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('keeps personal data out of the logs and tags lines with request and organisation ids', async () => {
    const ip = `2001:db8::${randomInt(1, 0xffff).toString(16)}`;
    const email = `${randomInt(1, 2 ** 31)}.${PII.email}`;
    const headers = { origin: WEB, 'x-forwarded-for': `${PII.ip}, ${ip}` };

    await request(app.getHttpServer())
      .post('/auth/magic-link')
      .set({ ...headers, 'x-request-id': 'req-signup-0001' })
      .send({ email, organiserName: PII.name })
      .expect(202);
    const token = outbox.lastTo(email)!.text.match(/#token=([\w-]+)/)![1]!;

    const verify = await request(app.getHttpServer())
      .post('/auth/magic-link/verify')
      .set({ ...headers, authorization: PII.authorization })
      .send({ token })
      .expect(200);
    const cookie = verify.headers['set-cookie']![0]!.split(';')[0]!;
    const orgId = verify.body.organisation.id as string;

    const members = await request(app.getHttpServer())
      .get(`/organisations/${orgId}/members?email=${encodeURIComponent(email)}`)
      .set({ cookie, 'x-request-id': 'req-members-0002' })
      .expect(200);
    expect(members.headers['x-request-id']).toBe('req-members-0002');

    const text = written.join('');
    expect(leaks(text)).toEqual([]);
    expect(text).not.toContain(email);
    expect(text).not.toContain(token);
    expect(text).not.toContain(cookie.split('=')[1]);

    const lines = logLines();
    const signup = lines.filter((line) => line.requestId === 'req-signup-0001');
    expect(signup.length).toBeGreaterThan(0);
    const membersDone = lines.find(
      (line) => line.requestId === 'req-members-0002' && line.msg === 'request completed',
    );
    expect(membersDone).toMatchObject({ organisationId: orgId, res: { statusCode: 200 } });
    expect((membersDone!.req as { url: string }).url).toBe(`/organisations/${orgId}/members`);
  });

  it('gives every request an id and returns it', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('x-request-id', 'bad id with spaces')
      .expect(401);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logs an unhandled error with its type and stack, and no personal data', async () => {
    await request(app.getHttpServer())
      .get('/throws')
      .set('x-request-id', 'req-throws-0003')
      .expect(500);

    const lines = logLines().filter((line) => line.requestId === 'req-throws-0003');
    expect(leaks(JSON.stringify(lines))).toEqual([]);
    const errorLine = lines.find((line) => line.context === 'ExceptionsHandler');
    expect(errorLine).toBeDefined();
    expect(errorLine!.msg).toContain('No account for');
    expect(errorLine!.err).toMatchObject({
      type: 'TypeError',
      message: expect.stringContaining('No account for'),
      stack: expect.stringContaining('ThrowingController'),
    });
  });
});
