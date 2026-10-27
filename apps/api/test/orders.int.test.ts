import 'reflect-metadata';
import { createPublicKey, randomUUID, verify } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  confirmationPath,
  type CreatedOrderDto,
  type CreateOrderBody,
  decodeTicketToken,
  type EventDraftDto,
  type HoldDto,
  ticketSigningInput,
} from '@onetickets/shared';
import type { NextFunction, Response } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Mailer, OutboxMailer } from '../src/modules/notifications/index.js';
import { SmtpMailer } from '../src/modules/notifications/mailer.js';
import { confirmationRateKey } from '../src/modules/checkout/confirmation-emails.js';
import { AppModule } from '../src/app.module.js';
import type { AppRequest } from '../src/modules/identity/index.js';
import type { TicketSigner } from '../src/modules/ticketing/signer.js';
import { TICKET_SIGNER } from '../src/modules/ticketing/tickets.service.js';
import { appDatabaseUrl, seedOrganisation, seedUser, uniqueEmail, withOwner } from './db.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('free orders and ticket keys (S2-2, S2-3, INV-5)', () => {
  let app: INestApplication;
  let signer: TicketSigner;
  let pool: pg.Pool;
  let owner: string;
  let org: string;
  let mailer: OutboxMailer;
  let requestIp = 'unknown';

  const server = () => app.getHttpServer();
  const origin = { origin: 'http://localhost:3000' };

  function as(userId: string) {
    const headers = { ...origin, 'x-test-user': userId, 'x-test-mfa': 'false' };
    return {
      post: (path: string, body: object = {}) =>
        request(server()).post(path).set(headers).send(body),
      patch: (path: string, body: object) => request(server()).patch(path).set(headers).send(body),
    };
  }

  async function publishedEvent(capacity = 10): Promise<EventDraftDto> {
    const { body: draft } = await as(owner)
      .post(`/organisations/${org}/events`, { template: 'workshop' })
      .expect(201);
    const startsAt = new Date(Date.now() + 3 * DAY);
    await as(owner)
      .patch(`/organisations/${org}/events/${draft.id}`, {
        version: draft.version,
        name: 'Order test night',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3 * HOUR).toISOString(),
        venue: { kind: 'online', url: 'https://meet.example.test/room' },
        contactEmail: 'hello@example.test',
      })
      .expect(200);
    const ticketTypeId = draft.ticketTypes[0]!.id;
    await as(owner)
      .patch(`/organisations/${org}/events/${draft.id}/ticket-types/${ticketTypeId}`, {
        name: 'General admission',
        capacity,
        maxPerOrder: 5,
        priceCents: 0,
        salesStart: { kind: 'on_publish' },
        salesEnd: { kind: 'event_start' },
      })
      .expect(200);
    const { body } = await as(owner)
      .post(`/organisations/${org}/events/${draft.id}/publish`)
      .expect(200);
    return body as EventDraftDto;
  }

  async function hold(event: EventDraftDto, quantity: number): Promise<HoldDto> {
    const { body } = await request(server())
      .post('/public/holds')
      .set(origin)
      .send({ ticketTypeId: event.ticketTypes[0]!.id, quantity })
      .expect(201);
    return body as HoldDto;
  }

  function orderBody(holds: HoldDto[], overrides: Partial<CreateOrderBody> = {}): CreateOrderBody {
    return {
      idempotencyKey: randomUUID(),
      holds: holds.map((h) => ({ id: h.id, token: h.token })),
      name: 'Alex Example',
      email: uniqueEmail('ticket-buyer'),
      marketingOptIn: false,
      ...overrides,
    };
  }

  const createOrder = (body: CreateOrderBody) =>
    request(server()).post('/public/orders').set(origin).send(body);

  const readTickets = (orderId: string, key?: string) => {
    const req = request(server()).get(`/public/orders/${orderId}/tickets`);
    return key === undefined ? req : req.set('authorization', `Bearer ${key}`);
  };

  async function inventory(event: EventDraftDto) {
    return withOwner(async (c) => {
      const { rows } = await c.query<{ sold: number; held: number }>(
        'select sold, held from inventory.ticket_inventory where ticket_type_id = $1',
        [event.ticketTypes[0]!.id],
      );
      return rows[0]!;
    });
  }

  async function verifies(qr: string): Promise<boolean> {
    const decoded = decodeTicketToken(qr)!;
    const spki = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      await signer.publicKey(),
    ]);
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return verify(null, ticketSigningInput(decoded.payload), key, decoded.signature);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: AppRequest, _res: Response, next: NextFunction) => {
      requestIp = req.ip ?? 'unknown';
      const userId = req.header('x-test-user');
      if (userId) req.auth = { userId, mfaVerified: req.header('x-test-mfa') === 'true' };
      next();
    });
    await app.init();
    signer = app.get(TICKET_SIGNER);
    mailer = app.get(Mailer);
    pool = new pg.Pool({ connectionString: appDatabaseUrl() });
    owner = await seedUser(uniqueEmail('owner'));
    org = await seedOrganisation('Order Test Org', [{ userId: owner, role: 'owner' }]);
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('turns holds into one order of signed tickets and a key that opens them', async () => {
    const event = await publishedEvent();
    const holds = [await hold(event, 2), await hold(event, 1)];
    const email = uniqueEmail('ticket-buyer').toUpperCase();
    const res = await createOrder(orderBody(holds, { email })).expect(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const order = res.body as CreatedOrderDto;

    expect(order.email).toBe(email.toLowerCase());
    expect(order.event).toMatchObject({ slug: event.slug, name: 'Order test night' });
    expect(order.event.venue).toEqual({ kind: 'online' });
    expect(order.tickets).toHaveLength(3);
    for (const ticket of order.tickets) {
      expect(ticket).toMatchObject({ holderName: 'Alex Example', status: 'valid' });
      expect(await verifies(ticket.qr!)).toBe(true);
      expect(decodeTicketToken(ticket.qr!)).toMatchObject({
        eventId: event.id,
        ticketId: ticket.id,
      });
    }
    expect(order.ticketKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await inventory(event)).toEqual({ sold: 3, held: 0 });

    const read = await readTickets(order.orderId, order.ticketKey).expect(200);
    expect(read.headers['cache-control']).toBe('no-store');
    expect(read.body).toEqual({ ...order, ticketKey: undefined });
    expect(read.body).not.toHaveProperty('ticketKey');
    expect(confirmationPath(order.orderId, order.ticketKey)).toBe(
      `/tickets/${order.orderId}#key=${order.ticketKey}`,
    );

    // The key is stored only as its hash.
    const stored = await withOwner((c) =>
      c.query('select key_hash from checkout.order_keys where order_id = $1', [order.orderId]),
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].key_hash.toString('base64url')).not.toBe(order.ticketKey);
  });

  it('returns the same order for the same idempotency key, even in parallel (INV-5)', async () => {
    const event = await publishedEvent();
    const body = orderBody([await hold(event, 2)]);
    const results = await Promise.all([1, 2, 3].map(() => createOrder(body)));
    for (const r of results) expect(r.status).toBe(201);
    const orders = results.map((r) => r.body as CreatedOrderDto);
    expect(new Set(orders.map((o) => o.orderId)).size).toBe(1);
    expect(new Set(orders.map((o) => o.ticketKey)).size).toBe(3);
    for (const o of orders) {
      expect(o.tickets.map((t) => t.id)).toEqual(orders[0]!.tickets.map((t) => t.id));
      await readTickets(o.orderId, o.ticketKey).expect(200);
    }
    const counts = await withOwner(async (c) => {
      const o = await c.query(
        'select count(*)::int as n from checkout.orders where event_id = $1',
        [event.id],
      );
      const t = await c.query(
        'select count(*)::int as n from ticketing.tickets where event_id = $1',
        [event.id],
      );
      return { orders: o.rows[0].n, tickets: t.rows[0].n };
    });
    expect(counts).toEqual({ orders: 1, tickets: 2 });
    expect(await inventory(event)).toEqual({ sold: 2, held: 0 });
  });

  it('emails one confirmation for concurrent retries, using saved buyer details and a working key', async () => {
    const event = await publishedEvent();
    const email = uniqueEmail('ticket-buyer');
    const body = orderBody([await hold(event, 2)], { email, marketingOptIn: false });
    const replies = await Promise.all(Array.from({ length: 6 }, () => createOrder(body)));
    expect(replies.map((r) => r.status)).toEqual(Array(6).fill(201));
    const order = replies[0]!.body as CreatedOrderDto;
    const messages = mailer.sent.filter((m) => m.to === email);
    expect(messages).toHaveLength(1);
    const message = messages[0]!;
    expect(message.replyTo).toBe('hello@example.test');
    expect(message.subject).toMatch(/^Your tickets for Order test night, /);
    expect(message.text).toContain('Ticket 2 of 2 · General admission · Ref ');
    expect(message.text).toContain('https://meet.example.test/room');
    expect(message.text).toContain('Cancellation policy:');
    const link = new URL(message.text.match(/See your tickets: (\S+)/)![1]!);
    expect(link.origin).toBe('http://localhost:3000');
    expect(link.pathname).toBe(`/tickets/${order.orderId}`);
    expect(link.search).toBe('');
    const key = new URLSearchParams(link.hash.slice(1)).get('key')!;
    await readTickets(order.orderId, key).expect(200);
    const receipt = await withOwner((c) =>
      c.query('select * from checkout.order_confirmations where order_id = $1', [order.orderId]),
    );
    expect(Object.keys(receipt.rows[0])).toEqual(['order_id', 'sent_at']);
    expect(receipt.rows[0].sent_at).toBeInstanceOf(Date);
    await createOrder({
      ...body,
      email: uniqueEmail('ticket-buyer'),
      name: 'Changed Buyer',
    }).expect(201);
    expect(mailer.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('keeps the booking on transport failure and retries delivery without duplicate stock or tickets', async () => {
    const event = await publishedEvent();
    const email = uniqueEmail('ticket-buyer');
    const body = orderBody([await hold(event, 2)], { email });
    const send = vi
      .spyOn(mailer, 'send')
      .mockRejectedValueOnce(new Error('private transport details'));
    try {
      const failed = await createOrder(body).expect(503);
      expect(failed.body.code).toBe('confirmation_email_unavailable');
      expect(JSON.stringify(failed.body)).not.toContain('private transport');
      expect(await inventory(event)).toEqual({ sold: 2, held: 0 });
      const order = (await createOrder(body).expect(201)).body as CreatedOrderDto;
      expect(mailer.sent.filter((m) => m.to === email)).toHaveLength(1);
      expect(order.tickets).toHaveLength(2);
      expect(await inventory(event)).toEqual({ sold: 2, held: 0 });
      await createOrder(body).expect(201);
      expect(mailer.sent.filter((m) => m.to === email)).toHaveLength(1);
    } finally {
      send.mockRestore();
    }
  });

  it('fails closed for a legacy event without Reply-To instead of silently substituting an address', async () => {
    const event = await publishedEvent();
    await withOwner((c) =>
      c.query('update catalogue.events set contact_email = null where id = $1', [event.id]),
    );
    const email = uniqueEmail('ticket-buyer');
    const body = orderBody([await hold(event, 1)], { email });
    await createOrder(body).expect(503);
    expect(mailer.lastTo(email)).toBeUndefined();
    await withOwner((c) =>
      c.query("update catalogue.events set contact_email = 'fixed@example.test' where id = $1", [
        event.id,
      ]),
    );
    await createOrder(body).expect(201);
    expect(mailer.lastTo(email)?.replyTo).toBe('fixed@example.test');
  });

  it.each(['email', 'ip', 'global'] as const)(
    'caps confirmation sends per %s before calling the transport',
    async (kind) => {
      const event = await publishedEvent();
      const email = uniqueEmail('ticket-buyer');
      const body = orderBody([await hold(event, 1)], { email });
      // Express sees the test request on the loopback address; keep the hash out of user data.
      const key =
        kind === 'global'
          ? 'confirmation:global'
          : confirmationRateKey(kind, kind === 'email' ? email : requestIp);
      await withOwner((c) =>
        c.query(
          `insert into identity.rate_limits (key, window_start, count)
         values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 100000)
         on conflict (key, window_start) do update set count = 100000`,
          [key, kind === 'ip' ? 900 : 3600],
        ),
      );
      try {
        const limited = await createOrder(body).set('x-forwarded-for', '198.51.100.1');
        expect(limited.status, kind).toBe(429);
        expect(mailer.lastTo(email)).toBeUndefined();
      } finally {
        await withOwner((c) => c.query('delete from identity.rate_limits where key = $1', [key]));
      }
      await createOrder(body).expect(201);
    },
  );

  it('delivers the real SMTP message to Mailpit with Reply-To and a usable ticket link', async () => {
    const event = await publishedEvent();
    const email = uniqueEmail('ticket-buyer');
    vi.stubEnv('SMTP_HOST', '127.0.0.1');
    vi.stubEnv('SMTP_PORT', process.env.TEST_SMTP_PORT ?? '1025');
    const smtp = new SmtpMailer();
    const send = vi.spyOn(mailer, 'send').mockImplementation((message) => smtp.send(message));
    try {
      const order = (await createOrder(orderBody([await hold(event, 1)], { email })).expect(201))
        .body as CreatedOrderDto;
      const base = process.env.TEST_MAILPIT_URL ?? 'http://127.0.0.1:8025';
      const response = await fetch(
        `${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      expect(response.ok).toBe(true);
      const found = (await response.json()) as { messages: { ID: string }[] };
      expect(found.messages).toHaveLength(1);
      const message = (await (
        await fetch(`${base}/api/v1/message/${found.messages[0]!.ID}`)
      ).json()) as {
        Subject: string;
        Text: string;
        ReplyTo: { Address: string }[];
      };
      expect(message.Subject).toMatch(/^Your tickets for Order test night, /);
      expect(message.ReplyTo.map((a) => a.Address)).toEqual(['hello@example.test']);
      expect(message.Text).toContain('Cancellation policy:');
      expect(message.Text).toContain('https://meet.example.test/room');
      const link = new URL(message.Text.match(/See your tickets: (\S+)/)![1]!);
      await readTickets(order.orderId, new URLSearchParams(link.hash.slice(1)).get('key')!).expect(
        200,
      );
    } finally {
      send.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('refuses the same idempotency key with other holds', async () => {
    const event = await publishedEvent();
    const body = orderBody([await hold(event, 1)]);
    await createOrder(body).expect(201);
    const other = await hold(event, 1);
    const res = await createOrder({ ...body, holds: [{ id: other.id, token: other.token }] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('idempotency_conflict');
    // A wrong token for the same hold id is "other holds" too.
    const forged = await createOrder({ ...body, holds: [{ id: body.holds[0]!.id, token: 'x' }] });
    expect(forged.status).toBe(409);
  });

  it('refuses a used or released hold, and keeps nothing, so a re-hold can retry', async () => {
    const event = await publishedEvent();
    const first = await hold(event, 1);
    await createOrder(orderBody([first])).expect(201);

    const body = orderBody([first]);
    const used = await createOrder(body);
    expect(used.status).toBe(410);
    expect(used.body.code).toBe('hold_expired');

    const lapsed = await hold(event, 1);
    await request(server())
      .post(`/public/holds/${lapsed.id}/release`)
      .set(origin)
      .send({ token: lapsed.token })
      .expect(200);
    const withLapsed = { ...body, holds: [{ id: lapsed.id, token: lapsed.token }] };
    expect((await createOrder(withLapsed)).status).toBe(410);

    // Nothing was kept, so the same checkout retries with a fresh hold.
    const fresh = await hold(event, 1);
    await createOrder({ ...body, holds: [{ id: fresh.id, token: fresh.token }] }).expect(201);
    expect(await inventory(event)).toEqual({ sold: 2, held: 0 });
  });

  it('refuses holds from two events and converts neither', async () => {
    const a = await publishedEvent();
    const b = await publishedEvent();
    const res = await createOrder(orderBody([await hold(a, 1), await hold(b, 1)]));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('holds_mixed_events');
    expect(await inventory(a)).toEqual({ sold: 0, held: 1 });
    expect(await inventory(b)).toEqual({ sold: 0, held: 1 });
  });

  it('validates the body', async () => {
    const event = await publishedEvent();
    const h = await hold(event, 1);
    for (const overrides of [
      { email: 'not-an-email' },
      { name: '  ' },
      { holds: [] },
      {
        holds: [
          { id: h.id, token: h.token },
          { id: h.id, token: h.token },
        ],
      },
      { idempotencyKey: 'abc' },
    ]) {
      expect(
        (await createOrder(orderBody([h], overrides as Partial<CreateOrderBody>))).status,
      ).toBe(422);
    }
  });

  it('opens tickets only with a live key for that order, and only as a bearer token', async () => {
    const event = await publishedEvent();
    const a = (await createOrder(orderBody([await hold(event, 1)])).expect(201))
      .body as CreatedOrderDto;
    const b = (await createOrder(orderBody([await hold(event, 1)])).expect(201))
      .body as CreatedOrderDto;

    const notFound = async (req: request.Test) => {
      const res = await req;
      expect(res.status).toBe(404);
      expect(res.headers['cache-control']).toBe('no-store');
      return res.body.code as string;
    };
    const codes = [
      await notFound(readTickets(a.orderId)),
      await notFound(readTickets(a.orderId, b.ticketKey)),
      await notFound(
        readTickets(a.orderId, a.ticketKey.slice(0, -1) + (a.ticketKey.endsWith('A') ? 'B' : 'A')),
      ),
      await notFound(readTickets(randomUUID(), a.ticketKey)),
      await notFound(readTickets('not-a-uuid', a.ticketKey)),
      await notFound(
        request(server()).get(`/public/orders/${a.orderId}/tickets?key=${a.ticketKey}`),
      ),
    ];
    // A wrong id and a wrong key look alike.
    expect(new Set(codes.filter((c) => c !== undefined && c !== 'not_found'))).toEqual(
      new Set(['order_not_found']),
    );

    await withOwner((c) =>
      c.query(
        "update checkout.order_keys set expires_at = now() - interval '1 second' where order_id = $1",
        [a.orderId],
      ),
    );
    await notFound(readTickets(a.orderId, a.ticketKey));
    await readTickets(b.orderId, b.ticketKey).expect(200);
  });

  describe('row-level security', () => {
    async function asApp<T>(
      orderId: string,
      work: (c: pg.PoolClient) => Promise<T>,
      organisationId = '',
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(
          "select set_config('app.order_id', $1, true), set_config('app.organisation_id', $2, true)",
          [orderId, organisationId],
        );
        return await work(client);
      } finally {
        await client.query('rollback');
        client.release();
      }
    }

    it('shows an order only to its own scope and its organiser', async () => {
      const event = await publishedEvent();
      const order = (await createOrder(orderBody([await hold(event, 1)])).expect(201))
        .body as CreatedOrderDto;
      const count = (c: pg.PoolClient) =>
        c
          .query('select count(*)::int as n from checkout.orders where id = $1', [order.orderId])
          .then((r) => r.rows[0].n as number);
      expect(await asApp(order.orderId, count)).toBe(1);
      expect(await asApp(randomUUID(), count)).toBe(0);
      expect(await asApp('', count)).toBe(0);
      expect(await asApp('', count, org)).toBe(1);
    });

    it('creates an order only as the order in scope, for a published event', async () => {
      const event = await publishedEvent();
      const insert = (c: pg.PoolClient, id: string, eventId = event.id) =>
        c.query(
          `insert into checkout.orders (id, organisation_id, event_id, buyer_name, buyer_email)
           values ($1, $2, $3, 'Test Buyer', 'buyer@example.test')`,
          [id, org, eventId],
        );
      const id = randomUUID();
      await expect(asApp(randomUUID(), (c) => insert(c, id))).rejects.toThrow(/row-level security/);
      const { body: draft } = await as(owner)
        .post(`/organisations/${org}/events`, { template: 'workshop' })
        .expect(201);
      // With the organiser in scope too, who can see the draft, so only the insert policy decides.
      await expect(asApp(id, (c) => insert(c, id, draft.id), org)).rejects.toThrow(
        /row-level security/,
      );
      await asApp(id, (c) => insert(c, id));
    });

    it('isolates confirmation receipts by order scope and grants only sent_at updates', async () => {
      const event = await publishedEvent();
      const order = (
        await createOrder(
          orderBody([await hold(event, 1)], { email: uniqueEmail('ticket-buyer') }),
        ).expect(201)
      ).body as CreatedOrderDto;
      for (const scope of ['', randomUUID()]) {
        const read = await asApp(scope, (c) =>
          c.query('select * from checkout.order_confirmations where order_id = $1', [
            order.orderId,
          ]),
        );
        expect(read.rows).toHaveLength(0);
        const update = await asApp(scope, (c) =>
          c.query('update checkout.order_confirmations set sent_at = null where order_id = $1', [
            order.orderId,
          ]),
        );
        expect(update.rowCount).toBe(0);
        await expect(
          asApp(scope, (c) =>
            c.query('insert into checkout.order_confirmations (order_id) values ($1)', [
              order.orderId,
            ]),
          ),
        ).rejects.toThrow(/row-level security/);
      }
      await expect(
        asApp(order.orderId, (c) =>
          c.query('update checkout.order_confirmations set order_id = $1', [randomUUID()]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asApp(order.orderId, (c) =>
          c.query('delete from checkout.order_confirmations where order_id = $1', [order.orderId]),
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it('never lets the api change or remove an order or a key', async () => {
      const event = await publishedEvent();
      const order = (await createOrder(orderBody([await hold(event, 1)])).expect(201))
        .body as CreatedOrderDto;
      for (const sql of [
        "update checkout.orders set buyer_name = 'X' where id = $1",
        'delete from checkout.orders where id = $1',
        "update checkout.order_keys set expires_at = now() + interval '1 year' where order_id = $1",
        'delete from checkout.order_keys where order_id = $1',
        'delete from checkout.order_requests where order_id = $1',
      ]) {
        await expect(asApp(order.orderId, (c) => c.query(sql, [order.orderId]))).rejects.toThrow(
          /permission denied/,
        );
      }
    });
  });
});
