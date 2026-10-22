import 'reflect-metadata';
import crypto from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EventDraftDto, HoldDto, OrderDto, PublicOrderDto } from '@onetickets/shared';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { AppRequest } from '../src/modules/identity/index.js';
import { seedOrganisation, seedUser, uniqueEmail, withOwner } from './db.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('orders and free checkout (S2-2, INV-5, ADR 0007)', () => {
  let app: INestApplication;
  let owner: string;
  let org: string;

  function as(userId: string) {
    const server = app.getHttpServer();
    const headers = {
      'x-test-user': userId,
      'x-test-mfa': 'false',
      origin: 'http://localhost:3000',
    };
    return {
      get: (path: string) => request(server).get(path).set(headers),
      post: (path: string, body: object = {}) => request(server).post(path).set(headers).send(body),
      patch: (path: string, body: object) => request(server).patch(path).set(headers).send(body),
    };
  }

  function anon() {
    const server = app.getHttpServer();
    const headers = { origin: 'http://localhost:3000' };
    return {
      get: (path: string) => request(server).get(path).set(headers),
      post: (path: string, body: object = {}) => request(server).post(path).set(headers).send(body),
    };
  }

  async function createPublishedEvent(
    capacity = 10,
    maxPerOrder = 5,
  ): Promise<{ event: EventDraftDto; ticketTypeId: string; slug: string }> {
    const { body: draft } = await as(owner)
      .post(`/organisations/${org}/events`, { template: 'workshop' })
      .expect(201);
    const startsAt = new Date(Date.now() + 3 * DAY);

    await as(owner)
      .patch(`/organisations/${org}/events/${draft.id}`, {
        version: draft.version,
        name: `Workshop Event ${Math.random().toString(36).slice(2, 8)}`,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3 * HOUR).toISOString(),
        venue: {
          kind: 'place',
          placeId: 'fake-marrickville-town-hall',
          name: 'Marrickville Town Hall',
          address: '303 Marrickville Rd, Marrickville NSW 2204',
          suburb: 'Marrickville',
          city: 'sydney',
          lat: -33.9112,
          lng: 151.1552,
        },
        contactEmail: 'contact@example.test',
      })
      .expect(200);

    const ticketTypeId = draft.ticketTypes[0]!.id;
    await as(owner)
      .patch(`/organisations/${org}/events/${draft.id}/ticket-types/${ticketTypeId}`, {
        name: 'General admission',
        capacity,
        maxPerOrder,
        priceCents: 0,
        salesStart: { kind: 'on_publish' },
        salesEnd: { kind: 'event_start' },
      })
      .expect(200);

    const { body: published } = await as(owner)
      .post(`/organisations/${org}/events/${draft.id}/publish`)
      .expect(200);

    return {
      event: published as EventDraftDto,
      ticketTypeId,
      slug: (published as EventDraftDto).slug!,
    };
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

    owner = await seedUser(uniqueEmail('owner'));
    org = await seedOrganisation('Orders Test Org', [{ userId: owner, role: 'owner' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes a free checkout order, converts hold, and issues tickets (S2-2)', async () => {
    const { event, ticketTypeId } = await createPublishedEvent(10, 5);

    // 1. Reserve hold for 2 tickets.
    const { body: hold } = await anon()
      .post('/public/holds', { ticketTypeId, quantity: 2 })
      .expect(201);
    const holdDto = hold as HoldDto;

    // Check inventory: held = 2, sold = 0.
    const invBefore = await withOwner(async (client) => {
      const { rows } = await client.query<{ capacity: number; sold: number; held: number }>(
        'select capacity, sold, held from inventory.ticket_inventory where ticket_type_id = $1',
        [ticketTypeId],
      );
      return rows[0]!;
    });
    expect(invBefore.held).toBe(2);
    expect(invBefore.sold).toBe(0);

    // 2. Submit free checkout.
    const idempotencyKey = crypto.randomUUID();
    const { body: order } = await anon()
      .post('/public/orders', {
        eventId: event.id,
        holdId: holdDto.id,
        holdToken: holdDto.token,
        idempotencyKey,
        attendeeName: 'Alex River',
        attendeeEmail: 'alex@example.test',
        optInOrganiser: true,
      })
      .expect(201);

    const orderDto = order as OrderDto;
    expect(orderDto.orderRef).toMatch(/^OT-[A-Z0-9]{8}$/);
    expect(orderDto.attendeeName).toBe('Alex River');
    expect(orderDto.attendeeEmail).toBe('alex@example.test');
    expect(orderDto.ticketCount).toBe(2);
    expect(orderDto.totalPriceCents).toBe(0);
    expect(orderDto.status).toBe('confirmed');
    expect(orderDto.tickets).toHaveLength(2);
    expect(orderDto.tickets[0]!.ticketRef).toMatch(/^T-[A-Z0-9]{8}$/);
    expect(orderDto.tickets[0]!.attendeeName).toBe('Alex River');
    expect(orderDto.tickets[0]!.status).toBe('valid');

    // 3. Verify stock conversion: held decremented to 0, sold incremented to 2 (INV-1, INV-2).
    const invAfter = await withOwner(async (client) => {
      const { rows } = await client.query<{ capacity: number; sold: number; held: number }>(
        'select capacity, sold, held from inventory.ticket_inventory where ticket_type_id = $1',
        [ticketTypeId],
      );
      return rows[0]!;
    });
    expect(invAfter.held).toBe(0);
    expect(invAfter.sold).toBe(2);

    // 4. Verify hold marked converted.
    const holdRow = await withOwner(async (client) => {
      const { rows } = await client.query<{ converted_at: Date | null }>(
        'select converted_at from inventory.holds where id = $1',
        [holdDto.id],
      );
      return rows[0]!;
    });
    expect(holdRow.converted_at).not.toBeNull();
  });

  it('enforces INV-5: identical idempotencyKey returns the same order without duplicate tickets', async () => {
    const { event, ticketTypeId } = await createPublishedEvent(10, 5);

    const { body: hold } = await anon()
      .post('/public/holds', { ticketTypeId, quantity: 3 })
      .expect(201);
    const holdDto = hold as HoldDto;

    const idempotencyKey = crypto.randomUUID();
    const orderPayload = {
      eventId: event.id,
      holdId: holdDto.id,
      holdToken: holdDto.token,
      idempotencyKey,
      attendeeName: 'Taylor Morgan',
      attendeeEmail: 'taylor@example.test',
      optInOrganiser: false,
    };

    // First submission
    const res1 = await anon().post('/public/orders', orderPayload).expect(201);
    const order1 = res1.body as OrderDto;

    // Second submission with exact same key (simulating retry or double click)
    const res2 = await anon().post('/public/orders', orderPayload).expect(201);
    const order2 = res2.body as OrderDto;

    // Both responses must be identical
    expect(order1.id).toBe(order2.id);
    expect(order1.orderRef).toBe(order2.orderRef);
    expect(order1.tickets).toHaveLength(3);
    expect(order2.tickets).toHaveLength(3);
    expect(order1.tickets[0]!.ticketRef).toBe(order2.tickets[0]!.ticketRef);

    // Database verification: exactly 1 order row, exactly 3 tickets
    const counts = await withOwner(async (client) => {
      const { rows: oRows } = await client.query<{ count: string }>(
        'select count(*)::text from orders.orders where idempotency_key = $1',
        [idempotencyKey],
      );
      const { rows: tRows } = await client.query<{ count: string }>(
        'select count(*)::text from orders.tickets where order_id = $1',
        [order1.id],
      );
      return { orders: parseInt(oRows[0]!.count, 10), tickets: parseInt(tRows[0]!.count, 10) };
    });
    expect(counts.orders).toBe(1);
    expect(counts.tickets).toBe(3);
  });

  it('enforces INV-5 under concurrent parallel submissions: exactly 1 order created', async () => {
    const { event, ticketTypeId } = await createPublishedEvent(20, 5);

    const { body: hold } = await anon()
      .post('/public/holds', { ticketTypeId, quantity: 2 })
      .expect(201);
    const holdDto = hold as HoldDto;

    const idempotencyKey = crypto.randomUUID();
    const payload = {
      eventId: event.id,
      holdId: holdDto.id,
      holdToken: holdDto.token,
      idempotencyKey,
      attendeeName: 'Concurrent Buyer',
      attendeeEmail: 'concurrent@example.test',
      optInOrganiser: false,
    };

    // Fire 6 requests in parallel with the exact same idempotency key
    const responses = await Promise.all([
      anon().post('/public/orders', payload),
      anon().post('/public/orders', payload),
      anon().post('/public/orders', payload),
      anon().post('/public/orders', payload),
      anon().post('/public/orders', payload),
      anon().post('/public/orders', payload),
    ]);

    // All must succeed (201)
    for (const res of responses) {
      expect(res.status).toBe(201);
    }

    // All must return the identical orderRef
    const orderRefs = new Set(responses.map((r) => (r.body as OrderDto).orderRef));
    expect(orderRefs.size).toBe(1);

    // Inventory sold count must be exactly 2 (not 12)
    const inv = await withOwner(async (client) => {
      const { rows } = await client.query<{ sold: number; held: number }>(
        'select sold, held from inventory.ticket_inventory where ticket_type_id = $1',
        [ticketTypeId],
      );
      return rows[0]!;
    });
    expect(inv.sold).toBe(2);
    expect(inv.held).toBe(0);
  });

  it('rejects order with invalid hold token', async () => {
    const { event, ticketTypeId } = await createPublishedEvent(10, 5);

    const { body: hold } = await anon()
      .post('/public/holds', { ticketTypeId, quantity: 1 })
      .expect(201);
    const holdDto = hold as HoldDto;

    const res = await anon()
      .post('/public/orders', {
        eventId: event.id,
        holdId: holdDto.id,
        holdToken: 'wrong-token',
        idempotencyKey: crypto.randomUUID(),
        attendeeName: 'Bad Token Buyer',
        attendeeEmail: 'bad@example.test',
      })
      .expect(410);

    expect(res.body.code).toBe('hold_expired');
  });

  it('validates required fields: rejects empty name or invalid email', async () => {
    const { event, ticketTypeId } = await createPublishedEvent(10, 5);
    const { body: hold } = await anon()
      .post('/public/holds', { ticketTypeId, quantity: 1 })
      .expect(201);
    const holdDto = hold as HoldDto;

    // Empty name
    await anon()
      .post('/public/orders', {
        eventId: event.id,
        holdId: holdDto.id,
        holdToken: holdDto.token,
        idempotencyKey: crypto.randomUUID(),
        attendeeName: '   ',
        attendeeEmail: 'valid@example.test',
      })
      .expect(422);

    // Invalid email
    await anon()
      .post('/public/orders', {
        eventId: event.id,
        holdId: holdDto.id,
        holdToken: holdDto.token,
        idempotencyKey: crypto.randomUUID(),
        attendeeName: 'Valid Name',
        attendeeEmail: 'not-an-email',
      })
      .expect(422);
  });

  it('supports public order lookup by orderRef', async () => {
    const { event, ticketTypeId } = await createPublishedEvent(10, 5);
    const { body: hold } = await anon()
      .post('/public/holds', { ticketTypeId, quantity: 1 })
      .expect(201);
    const holdDto = hold as HoldDto;

    const { body: order } = await anon()
      .post('/public/orders', {
        eventId: event.id,
        holdId: holdDto.id,
        holdToken: holdDto.token,
        idempotencyKey: crypto.randomUUID(),
        attendeeName: 'Lookup Test',
        attendeeEmail: 'lookup@example.test',
      })
      .expect(201);

    const orderDto = order as OrderDto;

    const { body: lookup } = await anon().get(`/public/orders/${orderDto.orderRef}`).expect(200);

    const publicOrder = lookup as PublicOrderDto;
    expect(publicOrder.orderRef).toBe(orderDto.orderRef);
    expect(publicOrder.attendeeName).toBe('Lookup Test');
    expect(publicOrder.ticketCount).toBe(1);
    expect(publicOrder.tickets).toHaveLength(1);
    expect(publicOrder.tickets[0]!.ticketRef).toMatch(/^T-[A-Z0-9]{8}$/);

    // Non-existent orderRef returns 404
    await anon().get('/public/orders/OT-NOTFOUND').expect(404);
  });
});
