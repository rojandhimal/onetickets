import 'reflect-metadata';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setScope, UnitOfWork } from '../src/database/unit-of-work.js';
import { AUTH_CONFIG, type AuthConfig } from '../src/modules/identity/auth.config.js';
import { AttendeeAuthRepository } from '../src/modules/identity/attendee-auth.repository.js';
import { configureTrustProxy } from '../src/http.js';
import { Mailer, OutboxMailer } from '../src/modules/notifications/index.js';
import { appDatabaseUrl, seedOrganisation, uniqueEmail, withOwner } from './db.js';

const WEB = 'http://localhost:3000';
const hash = (token: string) => createHash('sha256').update(token).digest();
const ipPrefix = randomBytes(2).readUInt16BE().toString(16);
let sequence = 0;
const ip = () => `2001:db8:${ipPrefix}::${(++sequence).toString(16)}`;

describe('restricted attendee links and sessions (SEC-4)', () => {
  let app: INestApplication;
  let outbox: OutboxMailer;
  let org: string;
  let eventId: string;
  let typeId: string;
  const server = () => app.getHttpServer();
  const post = (path: string, body: object = {}, headers: Record<string, string> = {}) =>
    request(server())
      .post(path)
      .set({ origin: WEB, 'x-forwarded-for': ip(), ...headers })
      .send(body);
  const get = (path: string, cookie?: string) => {
    const req = request(server()).get(path);
    return cookie ? req.set('cookie', cookie) : req;
  };
  async function link(email: string) {
    await post('/attendee/magic-link', { email }).expect(202);
    const match = outbox
      .lastTo(email.toLowerCase())
      ?.text.match(/\/my-tickets\/verify#token=([\w-]+)/);
    if (!match) throw new Error('Expected a confidential attendee email');
    return match[1]!;
  }
  async function signIn(email = uniqueEmail('attendee')) {
    const token = await link(email);
    const res = await post('/attendee/magic-link/verify', { token }).expect(200);
    const setCookie = res.headers['set-cookie']![0]!;
    return { email, cookie: setCookie.split(';')[0]!, setCookie, body: res.body };
  }
  async function seedOrder(email: string) {
    return withOwner(async (c) => {
      const orderId = randomUUID();
      await c.query(
        `insert into checkout.orders(id, organisation_id, event_id, buyer_name, buyer_email)
        values($1,$2,$3,'Alex Example',$4)`,
        [orderId, org, eventId, email],
      );
      const { rows } = await c.query<{ id: string }>(
        `insert into ticketing.tickets
        (ref,organisation_id,event_id,ticket_type_id,order_id)
        values($1,$2,$3,$4,$5) returning id`,
        [randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(), org, eventId, typeId, orderId],
      );
      return { orderId, ticketId: rows[0]!.id };
    });
  }
  beforeAll(async () => {
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'true');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication<NestExpressApplication>();
    configureTrustProxy(app as NestExpressApplication, { TRUST_PROXY_HOPS: '1' });
    await app.init();
    outbox = app.get(Mailer);
    org = await seedOrganisation('Attendee Test Org', []);
    await withOwner(async (c) => {
      const result = await c.query<{ id: string }>(
        `insert into catalogue.events
        (organisation_id,template,status,name,starts_at,ends_at,venue,slug,published_at)
        values($1,'workshop','published','Attendee test',now()+interval '1 day',now()+interval '2 days',
          '{"kind":"online","url":"https://meet.example.test/private-room"}', $2, now()) returning id`,
        [org, `attendee-${randomUUID()}`],
      );
      eventId = result.rows[0]!.id;
      const type = await c.query<{ id: string }>(
        `insert into catalogue.ticket_types
        (event_id,organisation_id,name,capacity,max_per_order,sales_start,sales_end)
        values($1,$2,'General admission',1000,5,'{"kind":"on_publish"}','{"kind":"event_start"}') returning id`,
        [eventId, org],
      );
      typeId = type.rows[0]!.id;
    });
  });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  afterEach(() => vi.restoreAllMocks());

  it('mails the same confidential link and responds identically for booked and unknown emails', async () => {
    const known = uniqueEmail('known-attendee');
    await seedOrder(known);
    for (const email of [known, uniqueEmail('unknown-attendee')]) {
      const res = await post('/attendee/magic-link', {
        email: `  ${email.toUpperCase()}  `,
      }).expect(202);
      expect(res.text).toBe('');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(outbox.lastTo(email)).toMatchObject({
        confidential: true,
        subject: 'Your OneTickets tickets',
      });
      expect(outbox.lastTo(email)!.text).toContain('It works for 15 minutes.');
    }
  });
  it('stores only the 256-bit token hash and sets a 15-minute expiry', async () => {
    const email = uniqueEmail('attendee-hash');
    const token = await link(email);
    expect(token).toMatch(/^[\w-]{43}$/);
    const result = await withOwner((c) =>
      c.query('select token_hash, expires_at from identity.attendee_links where email=$1', [email]),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].token_hash).toEqual(hash(token));
    expect(result.rows[0].expires_at.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(result.rows[0].expires_at.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
  });
  it('redeems exactly once even when two requests race', async () => {
    const token = await link(uniqueEmail('attendee-race'));
    const results = await Promise.all([
      post('/attendee/magic-link/verify', { token }),
      post('/attendee/magic-link/verify', { token }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
    await post('/attendee/magic-link/verify', { token }).expect(410);
  });
  it('rejects expired, superseded and invented links', async () => {
    const email = uniqueEmail('attendee-expired');
    const old = await link(email);
    const current = await link(email);
    await post('/attendee/magic-link/verify', { token: old }).expect(410);
    await withOwner((c) =>
      c.query(
        `update identity.attendee_links set expires_at=now()-interval '1 second' where email=$1`,
        [email],
      ),
    );
    await post('/attendee/magic-link/verify', { token: current }).expect(410);
    await post('/attendee/magic-link/verify', {
      token: randomBytes(32).toString('base64url'),
    }).expect(410);
  });
  it('creates a private restricted session, with only a hashed cookie stored', async () => {
    const signed = await signIn();
    expect(signed.body).toEqual({
      email: signed.email,
      expiresAt: expect.any(String),
      permissions: ['tickets:read'],
    });
    expect(signed.setCookie).toMatch(/^ot_attendee=/);
    expect(signed.setCookie).toContain('HttpOnly');
    expect(signed.setCookie).toContain('SameSite=Lax');
    const response = await get('/attendee/session', signed.cookie).expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body).toEqual(signed.body);
    const rows = await withOwner((c) =>
      c.query('select token_hash from identity.attendee_sessions where email=$1', [signed.email]),
    );
    expect(rows.rows.map((r) => r.token_hash)).toEqual([hash(signed.cookie.split('=')[1]!)]);
    const users = await withOwner((c) =>
      c.query('select id from identity.users where email=$1', [signed.email]),
    );
    expect(users.rows).toEqual([]);
    await get('/me', signed.cookie).expect(401);
    await post('/organisations', { name: 'Forbidden' }, { cookie: signed.cookie }).expect(401);
  });
  it('rotates the browser session and revokes it on sign-out', async () => {
    const first = await signIn();
    const token = await link(first.email);
    const second = await post(
      '/attendee/magic-link/verify',
      { token },
      { cookie: first.cookie },
    ).expect(200);
    const cookie = second.headers['set-cookie']![0]!.split(';')[0]!;
    expect(cookie).not.toBe(first.cookie);
    await get('/attendee/session', first.cookie).expect(401);
    const out = await post('/attendee/sign-out', {}, { cookie }).expect(204);
    expect(out.headers['clear-site-data']).toBe('"storage"');
    await get('/attendee/session', cookie).expect(401);
  });
  it.each(['expires_at', 'last_seen_at'])('rejects sessions beyond %s', async (field) => {
    const signed = await signIn();
    await withOwner((c) =>
      c.query(
        `update identity.attendee_sessions set ${field}=now()-interval '8 days' where email=$1`,
        [signed.email],
      ),
    );
    await get('/attendee/session', signed.cookie).expect(401);
  });
  it('rejects unknown cookies and sessionless reads', async () => {
    await get('/attendee/session', 'ot_attendee=made-up').expect(401);
    await get('/attendee/orders').expect(401);
    await get(`/attendee/orders/${randomUUID()}/tickets`).expect(401);
  });
  it('keeps privacy headers on failed requests and case-insensitive attendee routes', async () => {
    for (const path of ['/attendee/session', '/ATTENDEE/session']) {
      const response = await get(path).expect(401);
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    }
    const response = await post(
      '/attendee/magic-link',
      {},
      { origin: 'https://evil.example.test' },
    ).expect(403);
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });
  it('checks origin and JSON for requests, redemption and sign-out', async () => {
    for (const path of [
      '/attendee/magic-link',
      '/attendee/magic-link/verify',
      '/attendee/sign-out',
    ]) {
      await post(
        path,
        { email: uniqueEmail('csrf'), token: 'invented' },
        { origin: 'https://evil.example.test' },
      ).expect(403);
      await request(server())
        .post(path)
        .set('origin', WEB)
        .type('form')
        .send({ email: uniqueEmail('form') })
        .expect(415);
    }
  });
  it('denies all attendee endpoints when the runtime flag turns off', async () => {
    const signed = await signIn();
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'false');
    try {
      for (const path of [
        '/attendee/session',
        '/attendee/orders',
        `/attendee/orders/${randomUUID()}/tickets`,
      ])
        await get(path, signed.cookie).expect(404);
      for (const path of [
        '/attendee/magic-link',
        '/attendee/magic-link/verify',
        '/attendee/sign-out',
      ])
        await post(
          path,
          { email: signed.email, token: randomBytes(32).toString('base64url') },
          { cookie: signed.cookie },
        ).expect(404);
    } finally {
      vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'true');
    }
    await get('/attendee/session', signed.cookie).expect(200);
  });
  it('limits reads to the session email across orders and ticket ids without issuing bearer keys', async () => {
    const first = await signIn();
    const second = await signIn();
    const a = await seedOrder(first.email);
    const b = await seedOrder(second.email);
    const list = await get('/attendee/orders', first.cookie).expect(200);
    expect(list.body.nextCursor).toBeNull();
    expect(list.body.orders.map((o: { orderId: string }) => o.orderId)).toEqual([a.orderId]);
    const detail = await get(`/attendee/orders/${a.orderId}/tickets`, first.cookie).expect(200);
    expect(detail.body.tickets.map((t: { id: string }) => t.id)).toEqual([a.ticketId]);
    expect(detail.body).not.toHaveProperty('ticketKey');
    expect(detail.body.event.venue).toEqual({ kind: 'online' });
    await get(`/attendee/orders/${b.orderId}/tickets`, first.cookie).expect(404);
    await get(`/attendee/orders/${a.orderId}/tickets`, second.cookie).expect(404);
    expect((await get('/attendee/orders', (await signIn()).cookie).expect(200)).body).toEqual({
      orders: [],
      nextCursor: null,
    });
  });
  it('paginates more than 100 owned orders without dropping or duplicating them', async () => {
    const signed = await signIn();
    const ids = await withOwner(async (c) => {
      const result = await c.query<{ id: string }>(
        `insert into checkout.orders (organisation_id,event_id,buyer_name,buyer_email)
        select $1,$2,'Alex Example',$3 from generate_series(1,101) returning id`,
        [org, eventId, signed.email],
      );
      return result.rows.map((r) => r.id).sort();
    });
    const first = await get('/attendee/orders', signed.cookie).expect(200);
    expect(first.body.orders).toHaveLength(100);
    expect(first.body.nextCursor).toBe(ids[99]);
    const second = await get(
      `/attendee/orders?after=${first.body.nextCursor}`,
      signed.cookie,
    ).expect(200);
    expect(second.body.orders).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
    expect(
      [...first.body.orders, ...second.body.orders].map((o: { orderId: string }) => o.orderId),
    ).toEqual(ids);
    await get('/attendee/orders?after=invalid', signed.cookie).expect(422);
  });
  it('enforces buyer isolation and read-only access in PostgreSQL and clears pooled scope', async () => {
    const email = uniqueEmail('rls-attendee');
    const own = await seedOrder(email);
    const foreign = await seedOrder(uniqueEmail('rls-other'));
    const pool = new pg.Pool({ connectionString: appDatabaseUrl(), max: 1 });
    const uow = new UnitOfWork(pool);
    try {
      await uow.run({ attendeeEmail: email }, async (c) => {
        const orders = await c.query('select id from checkout.orders');
        expect(orders.rows.map((r) => r.id)).toEqual([own.orderId]);
        const tickets = await c.query('select id from ticketing.tickets');
        expect(tickets.rows.map((r) => r.id)).toEqual([own.ticketId]);
        const changed = await c.query(
          'update ticketing.tickets set signed_at=signed_at where id=$1',
          [own.ticketId],
        );
        expect(changed.rowCount).toBe(0);
        expect(
          (await c.query('select id from checkout.orders where id=$1', [foreign.orderId])).rows,
        ).toEqual([]);
        await setScope(c, {});
        expect((await c.query('select id from checkout.orders')).rows).toEqual([]);
        expect((await c.query('select id from ticketing.tickets')).rows).toEqual([]);
      });
      await expect(
        uow.run({ attendeeEmail: email }, (c) =>
          c.query(
            `insert into checkout.orders
        (organisation_id,event_id,buyer_name,buyer_email) values($1,$2,'Alex Example',$3)`,
            [org, eventId, email],
          ),
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        uow.run({ attendeeEmail: email }, (c) =>
          c.query(
            `insert into ticketing.tickets (ref,organisation_id,event_id,ticket_type_id,order_id)
           values ($1,$2,$3,$4,$5)`,
            [
              randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(),
              org,
              eventId,
              typeId,
              own.orderId,
            ],
          ),
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await uow.run({}, async (c) => {
        expect((await c.query('select id from checkout.orders')).rows).toEqual([]);
        expect((await c.query('select id from ticketing.tickets')).rows).toEqual([]);
        expect(
          (await c.query("select nullif(current_setting('app.attendee_email',true),'') as email"))
            .rows[0].email,
        ).toBeNull();
      });
    } finally {
      await pool.end();
    }
  });

  it('does not accept an organiser session as attendee authority', async () => {
    const email = uniqueEmail('organiser-only');
    await post('/auth/magic-link', { email }).expect(202);
    const token = outbox.lastTo(email)!.text.match(/\/auth\/verify#token=([\w-]+)/)![1]!;
    const res = await post('/auth/magic-link/verify', { token }).expect(200);
    const cookie = res.headers['set-cookie']![0]!.split(';')[0]!;
    await get('/attendee/session', cookie).expect(401);
    await get('/attendee/orders', cookie).expect(401);
  });
  it('returns the same safe failure for known and unknown emails when mail delivery fails', async () => {
    const known = uniqueEmail('mail-known');
    await seedOrder(known);
    const send = vi
      .spyOn(outbox, 'send')
      .mockRejectedValue(new Error('simulated transport failure'));
    try {
      const a = await post('/attendee/magic-link', { email: known }).expect(503);
      const b = await post('/attendee/magic-link', { email: uniqueEmail('mail-unknown') }).expect(
        503,
      );
      expect(a.body).toEqual(b.body);
      expect(a.body.code).toBe('attendee_mail_unavailable');
      expect(JSON.stringify(a.body)).not.toContain(known);
    } finally {
      send.mockRestore();
    }
  });
  it('rolls back redemption when session creation fails so the same link can be retried', async () => {
    const token = await link(uniqueEmail('rollback-link'));
    const repo = app.get(AttendeeAuthRepository);
    const create = vi
      .spyOn(repo, 'createSession')
      .mockRejectedValueOnce(new Error('simulated session write failure'));
    try {
      await post('/attendee/magic-link/verify', { token }).expect(500);
    } finally {
      create.mockRestore();
    }
    await post('/attendee/magic-link/verify', { token }).expect(200);
  });
  it('shares the global send cap with organiser sign-in', async () => {
    // A burst must stay in one rate window, even when the test starts just before rollover.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    const config = app.get<AuthConfig>(AUTH_CONFIG);
    const previous = config.magicLinkHourlyCap;
    const clear = () =>
      withOwner((c) => c.query("delete from identity.rate_limits where key='link:global'"));
    await clear();
    config.magicLinkHourlyCap = 3;
    try {
      await post('/auth/magic-link', { email: uniqueEmail('shared-organiser-cap') }).expect(202);
      await post('/attendee/magic-link', { email: uniqueEmail('shared-attendee-cap') }).expect(202);
      await post('/attendee/magic-link', { email: uniqueEmail('shared-attendee-cap') }).expect(202);
      const sent = outbox.sent.length;
      await post('/attendee/magic-link', { email: uniqueEmail('shared-attendee-cap') }).expect(429);
      expect(outbox.sent).toHaveLength(sent);
      await post('/auth/magic-link', { email: uniqueEmail('shared-organiser-cap') }).expect(429);
    } finally {
      config.magicLinkHourlyCap = previous;
      await clear();
    }
  });
  it('sets a Secure host-only attendee cookie when secure cookies are configured', async () => {
    const config = app.get<AuthConfig>(AUTH_CONFIG);
    const previous = config.secureCookies;
    config.secureCookies = true;
    try {
      const signed = await signIn();
      expect(signed.setCookie).toMatch(/^__Host-ot_attendee=/);
      expect(signed.setCookie).toContain('Secure');
      expect(signed.setCookie).toContain('Path=/');
      expect(signed.setCookie).not.toContain('Domain=');
      await get('/attendee/session', signed.cookie).expect(200);
    } finally {
      config.secureCookies = previous;
    }
  });

  it('limits requests per email', async () => {
    // A burst must stay in one rate window, even when the test starts just before rollover.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    const email = uniqueEmail('attendee-email-limit');
    for (let n = 0; n < 5; n++) await post('/attendee/magic-link', { email }).expect(202);
    await post('/attendee/magic-link', { email }).expect(429);
  });
  it('limits requests per real client IP even with a spoofed forwarded prefix', async () => {
    // A burst must stay in one rate window, even when the test starts just before rollover.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    const client = ip();
    for (let n = 0; n < 30; n++)
      await post(
        '/attendee/magic-link',
        { email: uniqueEmail('attendee-ip-limit') },
        { 'x-forwarded-for': `${ip()}, ${client}` },
      ).expect(202);
    await post(
      '/attendee/magic-link',
      { email: uniqueEmail('attendee-ip-limit') },
      { 'x-forwarded-for': `${ip()}, ${client}` },
    ).expect(429);
  });
  it('limits token guessing per IP', async () => {
    // A burst must stay in one rate window, even when the test starts just before rollover.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    const client = ip();
    for (let n = 0; n < 30; n++)
      await post(
        '/attendee/magic-link/verify',
        { token: randomBytes(32).toString('base64url') },
        { 'x-forwarded-for': client },
      ).expect(410);
    await post(
      '/attendee/magic-link/verify',
      { token: randomBytes(32).toString('base64url') },
      { 'x-forwarded-for': client },
    ).expect(429);
  });
});
