import 'reflect-metadata';
import { createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { decodeTicketToken, type EventDraftDto, ticketSigningInput } from '@onetickets/shared';
import type { NextFunction, Response } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { UnitOfWork } from '../src/database/unit-of-work.js';
import type { AppRequest } from '../src/modules/identity/index.js';
import { LocalEd25519Signer } from '../src/modules/ticketing/signer.js';
import { TicketsRepository } from '../src/modules/ticketing/tickets.repository.js';
import { TICKET_SIGNER, TicketsService } from '../src/modules/ticketing/tickets.service.js';
import { appDatabaseUrl, seedOrganisation, seedUser, uniqueEmail, withOwner } from './db.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function verifies(rawPublicKey: Uint8Array, payload: Uint8Array, signature: Uint8Array): boolean {
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPublicKey]);
  return verify(
    null,
    ticketSigningInput(payload),
    createPublicKey({ key: spki, format: 'der', type: 'spki' }),
    signature,
  );
}

describe('tickets (S2-3, ADR 0011)', () => {
  let app: INestApplication;
  let uow: UnitOfWork;
  let tickets: TicketsService;
  let signer: LocalEd25519Signer;
  let pool: pg.Pool;
  let owner: string;
  let org: string;
  let otherOrg: string;

  function as(userId: string) {
    const server = app.getHttpServer();
    const headers = {
      'x-test-user': userId,
      'x-test-mfa': 'false',
      origin: 'http://localhost:3000',
    };
    return {
      post: (path: string, body: object = {}) => request(server).post(path).set(headers).send(body),
      patch: (path: string, body: object) => request(server).patch(path).set(headers).send(body),
    };
  }

  async function draftEvent(organisationId = org): Promise<EventDraftDto> {
    const { body: draft } = await as(owner)
      .post(`/organisations/${organisationId}/events`, { template: 'workshop' })
      .expect(201);
    const startsAt = new Date(Date.now() + 3 * DAY);
    const { body } = await as(owner)
      .patch(`/organisations/${organisationId}/events/${draft.id}`, {
        version: draft.version,
        name: 'Ticket test night',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3 * HOUR).toISOString(),
        venue: { kind: 'online', url: 'https://meet.example.test/room' },
        contactEmail: 'hello@example.test',
      })
      .expect(200);
    return body as EventDraftDto;
  }

  async function publishedEvent(organisationId = org): Promise<EventDraftDto> {
    const draft = await draftEvent(organisationId);
    const { body } = await as(owner)
      .post(`/organisations/${organisationId}/events/${draft.id}/publish`)
      .expect(200);
    return body as EventDraftDto;
  }

  /** An order row for the event, as checkout makes it, in the caller's order scope. */
  function insertOrder(c: pg.ClientBase, event: EventDraftDto, orderId: string) {
    return c.query(
      `insert into checkout.orders (id, organisation_id, event_id, buyer_name, buyer_email)
       values ($1, $2, $3, 'Test Buyer', 'buyer@example.test')`,
      [orderId, event.organisationId, event.id],
    );
  }

  async function issue(event: EventDraftDto, quantity: number, orderId = randomUUID()) {
    await uow.run({ orderId }, async (tx) => {
      await insertOrder(tx, event, orderId);
      await tickets.issue(tx, {
        orderId,
        organisationId: event.organisationId,
        eventId: event.id,
        ticketTypeId: event.ticketTypes[0]!.id,
        quantity,
      });
    });
    return orderId;
  }

  const view = (orderId: string) => uow.run({ orderId }, (tx) => tickets.forOrder(tx, orderId));

  beforeAll(async () => {
    signer = new LocalEd25519Signer(randomBytes(32));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TICKET_SIGNER)
      .useValue(signer)
      .compile();
    app = moduleRef.createNestApplication();
    app.use((req: AppRequest, _res: Response, next: NextFunction) => {
      const userId = req.header('x-test-user');
      if (userId) req.auth = { userId, mfaVerified: req.header('x-test-mfa') === 'true' };
      next();
    });
    await app.init();
    uow = app.get(UnitOfWork);
    tickets = app.get(TicketsService);
    pool = new pg.Pool({ connectionString: appDatabaseUrl() });
    owner = await seedUser(uniqueEmail('owner'));
    org = await seedOrganisation('Ticket Test Org', [{ userId: owner, role: 'owner' }]);
    otherOrg = await seedOrganisation('Other Ticket Org', [{ userId: owner, role: 'owner' }]);
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('issues signed tickets whose QR verifies and carries no personal data', async () => {
    const event = await publishedEvent();
    const orderId = await issue(event, 3);
    expect(await tickets.signOrder(orderId)).toBe(3);

    const issued = await view(orderId);
    expect(issued).toHaveLength(3);
    const publicKey = await signer.publicKey();
    for (const ticket of issued) {
      expect(ticket.ref).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
      expect(ticket.ticketTypeName).toBe(event.ticketTypes[0]!.name);
      expect(ticket.holderName).toBe('Test Buyer');
      expect(ticket.status).toBe('valid');
      const decoded = decodeTicketToken(ticket.qr!)!;
      expect(decoded).toMatchObject({
        keyId: signer.keyId,
        eventId: event.id,
        ticketId: ticket.id,
        issuedAt: new Date(ticket.issuedAt),
      });
      expect(verifies(publicKey, decoded.payload, decoded.signature)).toBe(true);
      // Only the claims above fit in 45 bytes; nothing about the buyer or the order.
      expect(ticket.qr).not.toContain(orderId);
    }
    expect(new Set(issued.map((t) => t.ref)).size).toBe(3);
    expect(new Set(issued.map((t) => t.id)).size).toBe(3);
  });

  it('signs each ticket once, even when signers race', async () => {
    const event = await publishedEvent();
    const orderId = await issue(event, 5);
    const signed = await Promise.all([1, 2, 3, 4].map(() => tickets.signOrder(orderId)));
    expect(signed.reduce((a, b) => a + b, 0)).toBe(5);
    expect(await tickets.signOrder(orderId)).toBe(0);
    expect((await view(orderId)).every((t) => t.qr)).toBe(true);
  });

  it('leaves tickets unsigned, with no QR, when this process has no signer', async () => {
    const unsignedService = new TicketsService(uow, app.get(TicketsRepository), null);
    const event = await publishedEvent();
    const orderId = await issue(event, 2);
    expect(await unsignedService.signOrder(orderId)).toBe(0);
    expect((await view(orderId)).map((t) => t.qr)).toEqual([null, null]);
    // A signer that runs later (in AWS, the signing worker) picks them up.
    expect(await tickets.signOrder(orderId)).toBe(2);
  });

  it('never changes a signature once set', async () => {
    const event = await publishedEvent();
    const orderId = await issue(event, 1);
    await tickets.signOrder(orderId);
    await expect(
      withOwner((c) =>
        c.query('update ticketing.tickets set signature = $2 where order_id = $1', [
          orderId,
          randomBytes(64),
        ]),
      ),
    ).rejects.toThrow(/already signed/);
    await expect(
      withOwner((c) =>
        c.query(
          'update ticketing.tickets set key_id = null, signature = null, signed_at = null where order_id = $1',
          [orderId],
        ),
      ),
    ).rejects.toThrow(/already signed/);
  });

  describe('row-level security', () => {
    async function asApp<T>(
      scope: { organisationId?: string; orderId?: string },
      work: (c: pg.PoolClient) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(
          "select set_config('app.organisation_id', $1, true), set_config('app.order_id', $2, true)",
          [scope.organisationId ?? '', scope.orderId ?? ''],
        );
        return await work(client);
      } finally {
        await client.query('rollback');
        client.release();
      }
    }
    const count = (c: pg.PoolClient, orderId: string) =>
      c
        .query('select count(*)::int as n from ticketing.tickets where order_id = $1', [orderId])
        .then((r) => r.rows[0].n as number);

    it("shows an order's tickets only to that order and to the organiser", async () => {
      const event = await publishedEvent();
      const orderId = await issue(event, 2);
      expect(await asApp({ orderId }, (c) => count(c, orderId))).toBe(2);
      expect(await asApp({ orderId: randomUUID() }, (c) => count(c, orderId))).toBe(0);
      expect(await asApp({}, (c) => count(c, orderId))).toBe(0);
      expect(await asApp({ organisationId: org }, (c) => count(c, orderId))).toBe(2);
      expect(await asApp({ organisationId: otherOrg }, (c) => count(c, orderId))).toBe(0);
    });

    it('issues only for the order in scope and its event, under its own organisation', async () => {
      const event = await publishedEvent();
      const otherEvent = await publishedEvent();
      const orderId = randomUUID();
      await uow.run({ orderId }, (tx) => insertOrder(tx, event, orderId));
      const attempt = (overrides: object, scopeOrder = orderId) =>
        uow.run({ orderId: scopeOrder }, (tx) =>
          tickets.issue(tx, {
            orderId,
            organisationId: event.organisationId,
            eventId: event.id,
            ticketTypeId: event.ticketTypes[0]!.id,
            quantity: 1,
            ...overrides,
          }),
        );
      await expect(attempt({ organisationId: otherOrg })).rejects.toThrow(/row-level security/);
      await expect(attempt({ ticketTypeId: otherEvent.ticketTypes[0]!.id })).rejects.toThrow(
        /row-level security/,
      );
      // Another event's tickets, consistent in themselves, but not this order's event.
      await expect(
        attempt({ eventId: otherEvent.id, ticketTypeId: otherEvent.ticketTypes[0]!.id }),
      ).rejects.toThrow(/row-level security/);
      await expect(attempt({}, randomUUID())).rejects.toThrow(/row-level security/);
      await attempt({});
    });

    // The service's insert returns rows, so the select policies also stand in its way. These
    // inserts return nothing and run with the organiser in scope (who can see their own drafts),
    // so only the insert policy's own checks decide.
    it('checks the event is published and the order is in scope, on the insert itself', async () => {
      const insert = (c: pg.PoolClient, event: EventDraftDto, orderId: string) =>
        c.query(
          `insert into ticketing.tickets (ref, organisation_id, event_id, ticket_type_id, order_id)
           values ($1, $2, $3, $4, $5)`,
          ['AAAA0000', event.organisationId, event.id, event.ticketTypes[0]!.id, orderId],
        );
      // Checkout can't make an order for a draft, so seed one past row-level security.
      const draft = await draftEvent();
      const draftOrder = randomUUID();
      await withOwner((c) => insertOrder(c, draft, draftOrder));
      await expect(
        asApp({ organisationId: org, orderId: draftOrder }, (c) => insert(c, draft, draftOrder)),
      ).rejects.toThrow(/row-level security/);

      const event = await publishedEvent();
      const orderId = randomUUID();
      await withOwner((c) => insertOrder(c, event, orderId));
      await expect(
        asApp({ organisationId: org, orderId: randomUUID() }, (c) => insert(c, event, orderId)),
      ).rejects.toThrow(/row-level security/);
      // And the same insert goes in when both hold.
      await asApp({ organisationId: org, orderId }, (c) => insert(c, event, orderId));
    });

    it('lets nobody delete a ticket or write its other columns', async () => {
      const event = await publishedEvent();
      const orderId = await issue(event, 1);
      await expect(
        asApp({ orderId }, (c) =>
          c.query('delete from ticketing.tickets where order_id = $1', [orderId]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asApp({ orderId }, (c) =>
          c.query('update ticketing.tickets set revoked_at = null where order_id = $1', [orderId]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asApp({ orderId }, (c) =>
          c.query(
            "update ticketing.tickets set issued_at = now() - interval '1 day' where order_id = $1",
            [orderId],
          ),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
