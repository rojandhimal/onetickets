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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
      email: 'Alex@Example.test',
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
      const userId = req.header('x-test-user');
      if (userId) req.auth = { userId, mfaVerified: req.header('x-test-mfa') === 'true' };
      next();
    });
    await app.init();
    signer = app.get(TICKET_SIGNER);
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
    const res = await createOrder(orderBody(holds)).expect(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const order = res.body as CreatedOrderDto;

    expect(order.email).toBe('alex@example.test');
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
