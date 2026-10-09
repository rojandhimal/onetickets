import 'reflect-metadata';
import { randomInt } from 'node:crypto';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { RateLimiter } from '../src/modules/identity/rate-limiter.js';
import { uniqueEmail, withOwner } from './db.js';

const WEB = 'http://localhost:3000';
const clearGlobalCount = () =>
  withOwner((client) => client.query(`delete from identity.rate_limits where key = 'link:global'`));

// The service-wide cap on sign-in emails, whatever mix of addresses and IPs asks.
describe('hourly cap on sign-in emails', () => {
  let app: INestApplication;
  let previousCap: string | undefined;

  beforeAll(async () => {
    previousCap = process.env.MAGIC_LINK_HOURLY_CAP;
    process.env.MAGIC_LINK_HOURLY_CAP = '3';
    await clearGlobalCount();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    process.env.MAGIC_LINK_HOURLY_CAP = previousCap;
    await clearGlobalCount();
  });

  it('refuses sends over the cap from any address and logs one warning', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const send = () =>
      request(app.getHttpServer())
        .post('/auth/magic-link')
        .set({ origin: WEB, 'x-forwarded-for': `2001:db8::${randomInt(1, 0xffff).toString(16)}` })
        .send({ email: uniqueEmail('cap') });

    for (let i = 0; i < 3; i++) await send().expect(202);
    expect((await send().expect(429)).body.code).toBe('rate_limited');
    await send().expect(429);

    const capWarnings = warn.mock.calls.filter(([message]) =>
      String(message).includes('Sign-in email cap'),
    );
    expect(capWarnings).toHaveLength(1);
    warn.mockRestore();
  });

  it('counts the overlapping part of the previous hour', async () => {
    const hour = 60 * 60_000;
    const key = `test:rolling:${randomInt(1, 2 ** 31)}`;
    const windowStart = Math.floor(Date.now() / hour) * hour;
    await withOwner((client) =>
      client.query(
        'insert into identity.rate_limits (key, window_start, count) values ($1, $2, 4)',
        [key, new Date(windowStart - hour)],
      ),
    );
    // A quarter of the way into this hour, three quarters of the last one still counts: 3 of 4.
    const now = vi.spyOn(Date, 'now').mockReturnValue(windowStart + hour / 4);
    const limiter = app.get(RateLimiter, { strict: false });
    const hit = () => limiter.hit({ key, max: 5, windowMs: hour, rolling: true });
    try {
      await hit();
      await hit();
      await expect(hit()).rejects.toMatchObject({ status: 429 });
    } finally {
      now.mockRestore();
    }
  });
});
