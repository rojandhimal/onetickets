import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EventDraftDto, HoldDto, PublicEventDto } from '@onetickets/shared';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { HoldsService } from '../src/modules/inventory/index.js';
import { hashHoldToken, newHoldToken } from '../src/modules/inventory/secrets.js';
import type { AppRequest } from '../src/modules/identity/index.js';
import { seedOrganisation, seedUser, uniqueEmail, withOwner } from './db.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('inventory and ticket holds (S2-1, INV-1, INV-2, INV-3, INV-4, ARCH-2)', () => {
  let app: INestApplication;
  let holdsService: HoldsService;
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
    holdsService = app.get(HoldsService);

    owner = await seedUser(uniqueEmail('owner'));
    org = await seedOrganisation('Inventory Test Org', [{ userId: owner, role: 'owner' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('INV-1: Database Invariant sold + held <= capacity', () => {
    it('enforces sold + held <= capacity with a database CHECK constraint on inventory.ticket_inventory', async () => {
      const { ticketTypeId } = await createPublishedEvent(10, 5);

      // Attempt raw UPDATE past capacity as owner/superuser
      await expect(
        withOwner((client) =>
          client.query(
            'update inventory.ticket_inventory set held = 11 where ticket_type_id = $1',
            [ticketTypeId],
          ),
        ),
      ).rejects.toThrow(/ticket_inventory_within_capacity/);

      // Attempt raw UPDATE with negative held count
      await expect(
        withOwner((client) =>
          client.query(
            'update inventory.ticket_inventory set held = -1 where ticket_type_id = $1',
            [ticketTypeId],
          ),
        ),
      ).rejects.toThrow(/ticket_inventory_within_capacity/);

      // Attempt raw UPDATE with negative sold count
      await expect(
        withOwner((client) =>
          client.query(
            'update inventory.ticket_inventory set sold = -1 where ticket_type_id = $1',
            [ticketTypeId],
          ),
        ),
      ).rejects.toThrow(/ticket_inventory_within_capacity/);
    });
  });

  describe('INV-2: Atomic hold reservation & race condition test', () => {
    it('handles 50 parallel buyers racing for the last 10 tickets: exactly 10 succeed, 40 fail', async () => {
      const { ticketTypeId } = await createPublishedEvent(10, 1);

      // 50 concurrent buyers attempt to reserve 1 ticket simultaneously
      const results = await Promise.all(
        Array.from({ length: 50 }, () =>
          anon().post('/public/holds', { ticketTypeId, quantity: 1 }),
        ),
      );

      const successful = results.filter((r) => r.status === 201);
      const rejected = results.filter((r) => r.status === 409);

      expect(successful).toHaveLength(10);
      expect(rejected).toHaveLength(40);

      // Verify the invariant in Postgres directly
      const inventory = await withOwner(async (client) => {
        const { rows } = await client.query<{ held: number; sold: number; capacity: number }>(
          'select held, sold, capacity from inventory.ticket_inventory where ticket_type_id = $1',
          [ticketTypeId],
        );
        return rows[0]!;
      });

      expect(inventory.held).toBe(10);
      expect(inventory.sold).toBe(0);
      expect(inventory.capacity).toBe(10);

      // Verify all successful holds have unique tokens and are stored in inventory.holds
      const holdTokens = successful.map((r) => (r.body as HoldDto).token);
      const uniqueTokens = new Set(holdTokens);
      expect(uniqueTokens.size).toBe(10);

      const activeHolds = await withOwner(async (client) => {
        const { rows } = await client.query<{ count: string }>(
          'select count(*) from inventory.holds where ticket_type_id = $1 and released_at is null and converted_at is null',
          [ticketTypeId],
        );
        return Number(rows[0]!.count);
      });
      expect(activeHolds).toBe(10);
    });
  });

  describe('ARCH-2 & INV-15: Distinguishing sold out from all taken', () => {
    it('returns 409 all_taken when tickets are held, and public event shows soldOut: false', async () => {
      const { ticketTypeId, slug } = await createPublishedEvent(2, 2);

      // Hold all 2 tickets
      const holdRes = await anon().post('/public/holds', { ticketTypeId, quantity: 2 });
      expect(holdRes.status).toBe(201);
      expect(holdRes.body).toHaveProperty('id');

      // Next hold attempt receives 409 all_taken (ARCH-2 / INV-15)
      const conflictRes = await anon().post('/public/holds', { ticketTypeId, quantity: 1 });
      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body).toMatchObject({
        statusCode: 409,
        code: 'all_taken',
        message: 'All taken right now. Check back in a few minutes.',
      });

      // Public event page reports spotsLeft: 0, but soldOut: false (ARCH-2)
      const eventRes = await anon().get(`/public/events/${slug}`);
      expect(eventRes.status).toBe(200);
      const eventDto = eventRes.body as PublicEventDto;
      expect(eventDto.spotsLeft).toBe(0);
      expect(eventDto.soldOut).toBe(false);
      expect(eventDto.ticketTypes[0]!.spotsLeft).toBe(0);
      expect(eventDto.ticketTypes[0]!.soldOut).toBe(false);
    });

    it('returns 409 sold_out when tickets are sold, and public event shows soldOut: true', async () => {
      const { ticketTypeId, slug } = await createPublishedEvent(2, 2);

      // Simulate 2 sold tickets in inventory
      await withOwner((client) =>
        client.query(
          'update inventory.ticket_inventory set sold = 2, held = 0 where ticket_type_id = $1',
          [ticketTypeId],
        ),
      );

      // Hold attempt receives 409 sold_out
      const conflictRes = await anon().post('/public/holds', { ticketTypeId, quantity: 1 });
      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body).toMatchObject({
        statusCode: 409,
        code: 'sold_out',
        message: 'Those tickets have just gone. Nothing was booked.',
      });

      // Public event page reports spotsLeft: 0, and soldOut: true
      const eventRes = await anon().get(`/public/events/${slug}`);
      expect(eventRes.status).toBe(200);
      const eventDto = eventRes.body as PublicEventDto;
      expect(eventDto.spotsLeft).toBe(0);
      expect(eventDto.soldOut).toBe(true);
      expect(eventDto.ticketTypes[0]!.spotsLeft).toBe(0);
      expect(eventDto.ticketTypes[0]!.soldOut).toBe(true);
    });

    it('returns 409 insufficient_spots when fewer spots remain than requested', async () => {
      const { ticketTypeId } = await createPublishedEvent(3, 3);

      // Hold 2 of the 3 tickets
      const holdRes = await anon().post('/public/holds', { ticketTypeId, quantity: 2 });
      expect(holdRes.status).toBe(201);

      // Request 2 tickets when only 1 is left
      const res = await anon().post('/public/holds', { ticketTypeId, quantity: 2 });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        code: 'insufficient_spots',
        message: 'Only 1 ticket was left.',
        field: 'quantity',
        spotsLeft: 1,
      });
    });
  });

  describe('INV-4: Per-order limits', () => {
    it('refuses quantities above max_per_order with 422 invalid_quantity', async () => {
      const { ticketTypeId } = await createPublishedEvent(20, 4);

      // Request 5 tickets when maxPerOrder is 4
      const res = await anon().post('/public/holds', { ticketTypeId, quantity: 5 });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        statusCode: 422,
        code: 'invalid_quantity',
        field: 'quantity',
      });
    });

    it('refuses quantities less than 1', async () => {
      const { ticketTypeId } = await createPublishedEvent(20, 4);

      const res = await anon().post('/public/holds', { ticketTypeId, quantity: 0 });
      expect(res.status).toBe(422);
    });

    it('accepts quantity exactly equal to max_per_order', async () => {
      const { ticketTypeId } = await createPublishedEvent(20, 4);

      const res = await anon().post('/public/holds', { ticketTypeId, quantity: 4 });
      expect(res.status).toBe(201);
      expect((res.body as HoldDto).quantity).toBe(4);
    });
  });

  describe('Hold renewal and 20-minute cap', () => {
    it('renews an active hold extending its expiry by 10 minutes', async () => {
      const { ticketTypeId } = await createPublishedEvent(10, 5);
      const { body: hold } = await anon().post('/public/holds', { ticketTypeId, quantity: 1 });

      const initialExpiry = new Date(hold.expiresAt);

      // Renew hold
      const renewRes = await anon().post(`/public/holds/${hold.id}/renew`, { token: hold.token });
      expect(renewRes.status).toBe(200);

      const renewedExpiry = new Date(renewRes.body.expiresAt);
      expect(renewedExpiry.getTime()).toBeGreaterThanOrEqual(initialExpiry.getTime());
    });

    it('refuses renewal past the 20-minute maximum hold duration cap', async () => {
      const { ticketTypeId } = await createPublishedEvent(10, 5);
      const { body: hold } = await anon().post('/public/holds', { ticketTypeId, quantity: 1 });

      // Set created_at to 21 minutes ago in Postgres
      await withOwner((client) =>
        client.query(
          "update inventory.holds set created_at = now() - interval '21 minutes', expires_at = now() + interval '5 minutes' where id = $1",
          [hold.id],
        ),
      );

      const res = await anon().post(`/public/holds/${hold.id}/renew`, { token: hold.token });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        code: 'max_hold_duration_reached',
        message: 'Holds can be kept for up to 20 minutes.',
      });
    });

    it('refuses renewal of an expired hold with 410 hold_expired', async () => {
      const { ticketTypeId } = await createPublishedEvent(10, 5);
      const { body: hold } = await anon().post('/public/holds', { ticketTypeId, quantity: 1 });

      // Set expires_at into the past
      await withOwner((client) =>
        client.query(
          "update inventory.holds set expires_at = now() - interval '10 seconds' where id = $1",
          [hold.id],
        ),
      );

      const res = await anon().post(`/public/holds/${hold.id}/renew`, { token: hold.token });
      expect(res.status).toBe(410);
      expect(res.body).toMatchObject({
        statusCode: 410,
        code: 'hold_expired',
      });
    });
  });

  describe('Hold release and quantity adjustment', () => {
    it('releases a hold and decrements held inventory count', async () => {
      const { ticketTypeId } = await createPublishedEvent(10, 5);
      const { body: hold } = await anon().post('/public/holds', { ticketTypeId, quantity: 2 });

      // Verify held count is 2
      let held = await withOwner(async (client) => {
        const { rows } = await client.query<{ held: number }>(
          'select held from inventory.ticket_inventory where ticket_type_id = $1',
          [ticketTypeId],
        );
        return rows[0]!.held;
      });
      expect(held).toBe(2);

      // Release hold
      const releaseRes = await anon().post(`/public/holds/${hold.id}/release`, {
        token: hold.token,
      });
      expect(releaseRes.status).toBe(200);

      // Verify held count returned to 0
      held = await withOwner(async (client) => {
        const { rows } = await client.query<{ held: number }>(
          'select held from inventory.ticket_inventory where ticket_type_id = $1',
          [ticketTypeId],
        );
        return rows[0]!.held;
      });
      expect(held).toBe(0);

      // Subsequent release is idempotent
      const secondRelease = await anon().post(`/public/holds/${hold.id}/release`, {
        token: hold.token,
      });
      expect(secondRelease.status).toBe(200);
    });

    it('adjusts hold quantity atomically using previousHoldId and previousToken', async () => {
      const { ticketTypeId } = await createPublishedEvent(10, 5);

      // Hold 1 ticket
      const { body: hold1 } = await anon().post('/public/holds', { ticketTypeId, quantity: 1 });

      // Adjust to 3 tickets by supplying previous hold
      const res = await anon().post('/public/holds', {
        ticketTypeId,
        quantity: 3,
        previousHoldId: hold1.id,
        previousToken: hold1.token,
      });
      expect(res.status).toBe(201);
      const hold2 = res.body as HoldDto;
      expect(hold2.quantity).toBe(3);
      expect(hold2.id).not.toBe(hold1.id);

      // Inventory held is now 3
      const held = await withOwner(async (client) => {
        const { rows } = await client.query<{ held: number }>(
          'select held from inventory.ticket_inventory where ticket_type_id = $1',
          [ticketTypeId],
        );
        return rows[0]!.held;
      });
      expect(held).toBe(3);

      // Old hold is released
      const oldHold = await withOwner(async (client) => {
        const { rows } = await client.query<{ released_at: Date | null }>(
          'select released_at from inventory.holds where id = $1',
          [hold1.id],
        );
        return rows[0]!;
      });
      expect(oldHold.released_at).not.toBeNull();
    });

    it('rolls back and preserves previous hold if adjustment to higher quantity exceeds capacity', async () => {
      const { ticketTypeId } = await createPublishedEvent(3, 3);

      // Hold 2 of 3 tickets
      const { body: hold1 } = await anon().post('/public/holds', { ticketTypeId, quantity: 2 });

      // Buyer tries to adjust to 4 tickets (capacity is only 3)
      const res = await anon().post('/public/holds', {
        ticketTypeId,
        quantity: 4,
        previousHoldId: hold1.id,
        previousToken: hold1.token,
      });
      expect(res.status).toBe(422); // Max per order is 3, 4 is invalid

      // Previous hold is NOT lost and remains active
      const holdStatus = await anon().get(`/public/holds/${hold1.id}?token=${hold1.token}`);
      expect(holdStatus.status).toBe(200);
      expect(holdStatus.body.status).toBe('active');

      const held = await withOwner(async (client) => {
        const { rows } = await client.query<{ held: number }>(
          'select held from inventory.ticket_inventory where ticket_type_id = $1',
          [ticketTypeId],
        );
        return rows[0]!.held;
      });
      expect(held).toBe(2);
    });
  });

  describe('INV-3: Expired holds sweeper concurrency race test', () => {
    it('expires 100 holds, runs two sweepers at once: held drops by exactly 100, never below 0', async () => {
      // Sweep any leftover expired holds from earlier tests first
      await holdsService.sweepExpired(1000);

      const { event, ticketTypeId } = await createPublishedEvent(100, 100);

      // Seed 100 holds directly in Postgres
      await withOwner(async (client) => {
        for (let i = 0; i < 100; i++) {
          const token = newHoldToken();
          await client.query(
            `insert into inventory.holds (ticket_type_id, organisation_id, event_id, quantity, token_hash, expires_at)
             values ($1, $2, $3, 1, $4, now() - interval '5 seconds')`,
            [ticketTypeId, org, event.id, hashHoldToken(token)],
          );
        }
        await client.query(
          'update inventory.ticket_inventory set held = 100 where ticket_type_id = $1',
          [ticketTypeId],
        );
      });

      // Verify held is 100
      let held = await withOwner(async (client) => {
        const { rows } = await client.query<{ held: number }>(
          'select held from inventory.ticket_inventory where ticket_type_id = $1',
          [ticketTypeId],
        );
        return rows[0]!.held;
      });
      expect(held).toBe(100);

      // Run two sweepers simultaneously (INV-3)
      const [swept1, swept2] = await Promise.all([
        holdsService.sweepExpired(100),
        holdsService.sweepExpired(100),
      ]);

      expect(swept1 + swept2).toBe(100);

      // Held count in ticket_inventory is now exactly 0, never below 0
      held = await withOwner(async (client) => {
        const { rows } = await client.query<{ held: number }>(
          'select held from inventory.ticket_inventory where ticket_type_id = $1',
          [ticketTypeId],
        );
        return rows[0]!.held;
      });
      expect(held).toBe(0);

      // Running sweeper a third time sweeps 0 holds
      const swept3 = await holdsService.sweepExpired(100);
      expect(swept3).toBe(0);
    });
  });
});
