import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EventDraftDto } from '@onetickets/shared';
import type { NextFunction, Response } from 'express';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { AppRequest } from '../src/modules/identity/index.js';
import { appDatabaseUrl, seedOrganisation, seedUser, uniqueEmail, withOwner } from './db.js';
import pg from 'pg';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const sydneyPlace = {
  kind: 'place',
  placeId: 'place-123',
  name: 'Marrickville Town Hall',
  address: '303 Marrickville Rd, Marrickville NSW 2204',
  suburb: 'Marrickville',
  city: 'sydney',
  lat: -33.911,
  lng: 151.155,
} as const;

describe('events and ticket types API', () => {
  let app: INestApplication;
  let owner: string;
  let admin: string;
  let finance: string;
  let door: string;
  let stranger: string;
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
      get: (path: string) => request(server).get(path).set(headers),
      post: (path: string, body: object = {}) => request(server).post(path).set(headers).send(body),
      patch: (path: string, body: object) => request(server).patch(path).set(headers).send(body),
      delete: (path: string) => request(server).delete(path).set(headers),
      put: (path: string, type: string, body: Buffer) =>
        request(server).put(path).set(headers).set('content-type', type).send(body),
    };
  }
  const anon = () => request(app.getHttpServer());
  const events = (organisationId = org) => `/organisations/${organisationId}/events`;

  async function draft(template = 'workshop', organisationId = org): Promise<EventDraftDto> {
    const { body } = await as(owner).post(events(organisationId), { template }).expect(201);
    return body as EventDraftDto;
  }

  async function publishable(
    patch: Record<string, unknown> = {},
    organisationId = org,
  ): Promise<EventDraftDto> {
    const event = await draft('workshop', organisationId);
    const startsAt = new Date(Date.now() + 3 * DAY);
    const { body } = await as(owner)
      .patch(`${events(organisationId)}/${event.id}`, {
        version: event.version,
        name: 'Pottery for beginners',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3 * HOUR).toISOString(),
        venue: sydneyPlace,
        contactEmail: 'hello@example.test',
        ...patch,
      })
      .expect(200);
    return body as EventDraftDto;
  }

  async function publish(event: EventDraftDto, organisationId = org): Promise<EventDraftDto> {
    const { body } = await as(owner)
      .post(`${events(organisationId)}/${event.id}/publish`)
      .expect(200);
    return body as EventDraftDto;
  }

  /** Every browse result for a query, following cursors (other tests' events share the DB). */
  async function browseAll(query: Record<string, string>): Promise<string[]> {
    const slugs: string[] = [];
    let cursor: string | null = null;
    type Page = { items: { slug: string }[]; nextCursor: string | null };
    do {
      const response = await anon()
        .get('/public/events')
        .query({ ...query, limit: '50', ...(cursor ? { cursor } : {}) })
        .expect(200);
      const body = response.body as Page;
      slugs.push(...body.items.map((item) => item.slug));
      cursor = body.nextCursor;
    } while (cursor);
    return slugs;
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
    const users = await Promise.all(
      ['owner', 'admin', 'finance', 'door', 'stranger'].map((label) =>
        seedUser(uniqueEmail(label)),
      ),
    );
    [owner, admin, finance, door, stranger] = users as [string, string, string, string, string];
    org = await seedOrganisation('Clay Collective', [
      { userId: owner!, role: 'owner' },
      { userId: admin!, role: 'admin' },
      { userId: finance!, role: 'finance' },
      { userId: door!, role: 'door_staff' },
    ]);
    otherOrg = await seedOrganisation('Other Org', [{ userId: owner!, role: 'owner' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts a draft from a template with a free general admission ticket', async () => {
    const event = await draft('gig');
    expect(event).toMatchObject({
      status: 'draft',
      template: 'gig',
      name: null,
      lastStep: 'basics',
      slug: null,
      banner: null,
      ticketTypes: [
        {
          name: 'General admission',
          capacity: 100,
          maxPerOrder: 10,
          priceCents: 0,
          salesStart: { kind: 'on_publish' },
          salesEnd: { kind: 'event_start' },
          sold: 0,
        },
      ],
    });
  });

  it('lets owners and admins manage events, but not finance, door staff or strangers', async () => {
    await as(admin).post(events(), { template: 'meetup' }).expect(201);
    expect((await as(finance).post(events(), { template: 'meetup' }).expect(403)).body.code).toBe(
      'forbidden',
    );
    await as(door).get(events()).expect(403);
    expect((await as(stranger).get(events()).expect(404)).body.code).toBe('not_a_member');
    await anon().get(events()).expect(401);
  });

  it('refuses every change to an event from finance and door staff', async () => {
    const event = await publishable();
    const path = `${events()}/${event.id}`;
    const type = event.ticketTypes[0]!;
    const ticket = { ...type, id: undefined, sold: undefined };
    for (const userId of [finance, door]) {
      const calls = [
        () => as(userId).get(path),
        () => as(userId).patch(path, { version: event.version, name: 'Taken over' }),
        () => as(userId).post(`${path}/publish`),
        () => as(userId).post(`${path}/ticket-types`, ticket),
        () => as(userId).patch(`${path}/ticket-types/${type.id}`, ticket),
        () => as(userId).delete(`${path}/ticket-types/${type.id}`),
        () => as(userId).put(`${path}/banner`, 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
        () => as(userId).delete(`${path}/banner`),
      ];
      for (const call of calls) expect((await call()).status).toBe(403);
    }
    const unchanged = await as(owner).get(path).expect(200);
    expect(unchanged.body).toMatchObject({ status: 'draft', version: event.version });
  });

  it("never shows one organisation's event to another, even to a member of both", async () => {
    const event = await draft();
    const response = await as(owner)
      .get(`${events(otherOrg)}/${event.id}`)
      .expect(404);
    expect(response.body.code).toBe('event_not_found');
    await as(owner)
      .patch(`${events(otherOrg)}/${event.id}`, { version: 0, name: 'Hijacked' })
      .expect(404);
    const list = await as(owner).get(events(otherOrg)).expect(200);
    expect(list.body.items.map((e: EventDraftDto) => e.id)).not.toContain(event.id);
  });

  it('autosaves, stores descriptions as plain text and bumps the version', async () => {
    const event = await draft();
    const { body } = await as(owner)
      .patch(`${events()}/${event.id}`, {
        version: 0,
        name: 'Wheel throwing',
        about: '<p>Bring an apron.</p><script>alert(1)</script>\u202E',
        accessibility: { features: ['hearing_loop', 'hearing_loop'], notes: '<b>Ramp</b> at side' },
        lastStep: 'details',
      })
      .expect(200);
    expect(body).toMatchObject({
      version: 1,
      name: 'Wheel throwing',
      about: 'Bring an apron.alert(1)',
      accessibility: { features: ['hearing_loop'], notes: 'Ramp at side' },
      lastStep: 'details',
    });
  });

  it('keeps names and venues to one clean line, with no hidden or reordering characters', async () => {
    const event = await draft();
    const { body } = await as(owner)
      .patch(`${events()}/${event.id}`, {
        version: 0,
        name: 'Free gig ‮gpj.exe​\nnow',
        venue: {
          kind: 'place',
          placeId: 'p1',
          name: 'The⁦ Hall',
          address: '1 Main St\r\nLevel 2',
          suburb: 'Newtown‍',
          city: 'sydney',
          lat: -33.89,
          lng: 151.18,
        },
      })
      .expect(200);
    expect(body).toMatchObject({
      name: 'Free gig gpj.exe now',
      venue: { name: 'The Hall', address: '1 Main St Level 2', suburb: 'Newtown' },
    });
    await as(owner).patch(`${events()}/${event.id}`, { version: 1, name: '‮​' }).expect(422);
    const ticket = await as(owner)
      .post(`${events()}/${event.id}/ticket-types`, {
        name: 'General‮ admission',
        capacity: 10,
        maxPerOrder: 2,
        priceCents: 0,
        salesStart: { kind: 'on_publish' },
        salesEnd: { kind: 'event_start' },
      })
      .expect(201);
    expect(ticket.body.ticketTypes.map((t: { name: string }) => t.name)).toContain(
      'General admission',
    );
  });

  it('refuses a stale autosave and returns the current draft', async () => {
    const event = await draft();
    await as(owner).patch(`${events()}/${event.id}`, { version: 0, name: 'First' }).expect(200);
    const stale = await as(owner)
      .patch(`${events()}/${event.id}`, { version: 0, name: 'Second' })
      .expect(409);
    expect(stale.body).toMatchObject({
      code: 'stale_draft',
      current: { id: event.id, version: 1, name: 'First' },
    });
  });

  it('refuses an end before the start, even when set in separate saves', async () => {
    const event = await publishable();
    const response = await as(owner)
      .patch(`${events()}/${event.id}`, {
        version: event.version,
        endsAt: new Date(Date.parse(event.startsAt!) - HOUR).toISOString(),
      })
      .expect(422);
    expect(response.body).toMatchObject({ code: 'ends_before_start', field: 'endsAt' });
  });

  it('gives every ticket type an inventory row the database never lets oversell (INV-1)', async () => {
    const event = await draft();
    const type = event.ticketTypes[0]!;
    const pool = new pg.Pool({ connectionString: appDatabaseUrl() });
    const asApp = async <T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(
          "select set_config('app.organisation_id', $1, true), set_config('app.user_id', $2, true)",
          [org, owner],
        );
        return await work(client);
      } finally {
        await client.query('rollback');
        client.release();
      }
    };
    const inventory = () =>
      withOwner(async (client) => {
        const { rows } = await client.query(
          'select capacity, sold, held from inventory.ticket_inventory where ticket_type_id = $1',
          [type.id],
        );
        return rows;
      });
    try {
      expect(await inventory()).toEqual([{ capacity: type.capacity, sold: 0, held: 0 }]);

      for (const change of [
        'set sold = 60, held = 41',
        'set sold = capacity + 1',
        'set held = -1',
        'set capacity = 0',
      ]) {
        await expect(
          asApp((client) =>
            client.query(`update inventory.ticket_inventory ${change} where ticket_type_id = $1`, [
              type.id,
            ]),
          ),
        ).rejects.toThrow(/ticket_inventory_within_capacity|check constraint/);
      }
      await expect(
        asApp((client) =>
          client.query('delete from inventory.ticket_inventory where ticket_type_id = $1', [
            type.id,
          ]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asApp((client) =>
          client.query('update catalogue.ticket_types set event_id = event_id where id = $1', [
            type.id,
          ]),
        ),
      ).rejects.toThrow(/permission denied/);

      // Capacity changes reach inventory in the same transaction, and can't go below sold.
      const edit = { ...type, id: undefined, sold: undefined, capacity: 40, maxPerOrder: 5 };
      await as(owner).patch(`${events()}/${event.id}/ticket-types/${type.id}`, edit).expect(200);
      expect(await inventory()).toEqual([{ capacity: 40, sold: 0, held: 0 }]);
      await withOwner((client) =>
        client.query('update inventory.ticket_inventory set sold = 30 where ticket_type_id = $1', [
          type.id,
        ]),
      );
      const shrink = await as(owner)
        .patch(`${events()}/${event.id}/ticket-types/${type.id}`, { ...edit, capacity: 20 })
        .expect(409);
      expect(shrink.body.code).toBe('tickets_sold_or_held');
      await as(owner)
        .post(`${events()}/${event.id}/ticket-types`, { ...edit, name: 'Second' })
        .expect(201);
      const removed = await as(owner)
        .delete(`${events()}/${event.id}/ticket-types/${type.id}`)
        .expect(409);
      expect(removed.body.code).toBe('tickets_sold_or_held');
      const after = await as(owner).get(`${events()}/${event.id}`).expect(200);
      expect(after.body.ticketTypes[0]).toMatchObject({ id: type.id, capacity: 40, sold: 30 });
    } finally {
      await pool.end();
    }
  });

  it('refuses a ticket price over A$10,000 with 422, in the api and the database', async () => {
    const event = await draft();
    const type = event.ticketTypes[0]!;
    const ticket = { ...type, id: undefined, sold: undefined };
    for (const priceCents of [1_000_001, 2 ** 31]) {
      const response = await as(owner)
        .post(`${events()}/${event.id}/ticket-types`, { ...ticket, priceCents })
        .expect(422);
      expect(response.body).toMatchObject({ code: 'invalid_request', field: 'priceCents' });
    }
    await expect(
      withOwner((client) =>
        client.query('update catalogue.ticket_types set price_cents = 1000001 where id = $1', [
          type.id,
        ]),
      ),
    ).rejects.toThrow(/ticket_types_price_limit/);
  });

  it('keeps ticket types free while paid tickets are off', async () => {
    const event = await draft();
    const response = await as(owner)
      .post(`${events()}/${event.id}/ticket-types`, {
        name: 'VIP',
        capacity: 10,
        maxPerOrder: 2,
        priceCents: 5000,
        salesStart: { kind: 'on_publish' },
        salesEnd: { kind: 'event_start' },
      })
      .expect(422);
    expect(response.body.code).toBe('paid_tickets_disabled');

    const free = event.ticketTypes[0]!;
    const edited = await as(owner)
      .patch(`${events()}/${event.id}/ticket-types/${free.id}`, {
        name: free.name,
        capacity: free.capacity,
        maxPerOrder: free.maxPerOrder,
        priceCents: 1500,
        salesStart: free.salesStart,
        salesEnd: free.salesEnd,
      })
      .expect(422);
    expect(edited.body).toMatchObject({ code: 'paid_tickets_disabled', field: 'priceCents' });
    const after = await as(owner).get(`${events()}/${event.id}`).expect(200);
    expect(after.body.ticketTypes[0].priceCents).toBe(0);
  });

  it('adds, edits and removes ticket types, returning the event with its new version', async () => {
    const event = await draft();
    const added = await as(owner)
      .post(`${events()}/${event.id}/ticket-types`, {
        name: 'Members',
        capacity: 10,
        maxPerOrder: 2,
        priceCents: 0,
        salesStart: { kind: 'on_publish' },
        salesEnd: { kind: 'day_before' },
      })
      .expect(201);
    expect(added.body.version).toBe(event.version + 1);
    const members = added.body.ticketTypes.find((t: { name: string }) => t.name === 'Members');

    const edited = await as(owner)
      .patch(`${events()}/${event.id}/ticket-types/${members.id}`, {
        ...members,
        id: undefined,
        sold: undefined,
        capacity: 12,
      })
      .expect(200);
    expect(edited.body.ticketTypes.map((t: { capacity: number }) => t.capacity)).toEqual([40, 12]);

    const over = await as(owner)
      .patch(`${events()}/${event.id}/ticket-types/${members.id}`, {
        name: 'Members',
        capacity: 1,
        maxPerOrder: 2,
        priceCents: 0,
        salesStart: { kind: 'on_publish' },
        salesEnd: { kind: 'day_before' },
      })
      .expect(422);
    expect(over.body.message).toBe('max_per_order_over_capacity');

    const removed = await as(owner)
      .delete(`${events()}/${event.id}/ticket-types/${members.id}`)
      .expect(200);
    expect(removed.body.ticketTypes).toHaveLength(1);
  });

  it('lists everything still needed before publishing', async () => {
    const event = await draft();
    await as(owner)
      .delete(`${events()}/${event.id}/ticket-types/${event.ticketTypes[0]!.id}`)
      .expect(200);
    const response = await as(owner).post(`${events()}/${event.id}/publish`).expect(422);
    expect(response.body).toMatchObject({
      code: 'not_ready',
      missing: ['name', 'date_time', 'venue', 'ticket_type'],
    });
  });

  it('publishes to a public page that hides private details', async () => {
    const event = await publishable({
      venue: { kind: 'online', url: 'https://meet.example.test/secret-room' },
    });
    await anon().get(`/public/events/${event.id}`).expect(404);

    const published = await publish(event);
    expect(published.status).toBe('published');
    expect(published.slug).toMatch(/^pottery-for-beginners-[a-z0-9]{7}$/);

    const { body, text } = await anon().get(`/public/events/${published.slug}`).expect(200);
    expect(body).toMatchObject({
      name: 'Pottery for beginners',
      organiser: { name: 'Clay Collective' },
      venue: { kind: 'online' },
      hasContactEmail: true,
      priceFromAllInCents: 0,
      spotsLeft: 40,
      ticketTypes: [{ name: 'General admission', onSale: true, spotsLeft: 40, maxPerOrder: 10 }],
    });
    expect(text).not.toContain('secret-room');
    expect(text).not.toContain('hello@example.test');
    expect(text).not.toContain(org);
  });

  it('keeps drafts off the public page and out of browse', async () => {
    const upcoming = await publish(await publishable());
    const draftEvent = await publishable();
    const past = await publish(await publishable());
    await withOwner((client) =>
      client.query(
        `update catalogue.events
            set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour'
          where id = $1`,
        [past.id],
      ),
    );
    const melbourne = await publish(
      await publishable({ venue: { ...sydneyPlace, city: 'melbourne', suburb: 'Fitzroy' } }),
    );

    const sydney = await browseAll({ city: 'sydney' });
    expect(sydney).toContain(upcoming.slug);
    expect(sydney).not.toContain(past.slug);
    expect(sydney).not.toContain(melbourne.slug);
    const everything = [
      ...sydney,
      ...(await browseAll({ city: 'melbourne' })),
      ...(await browseAll({ city: 'sydney', when: 'next_7_days' })),
    ];
    expect(everything).not.toContain(past.slug);
    const published = await withOwner((client) =>
      client.query<{ slug: string }>(
        "select slug from catalogue.events where status = 'published'",
      ),
    );
    const publishedSlugs = new Set(published.rows.map((row) => row.slug));
    expect(everything.every((slug) => publishedSlugs.has(slug))).toBe(true);
    await anon().get(`/public/events/${draftEvent.id}`).expect(404);
  });

  it('keeps a live event bookable: its venue and last ticket type stay', async () => {
    const event = await publish(await publishable());
    const venue = await as(owner)
      .patch(`${events()}/${event.id}`, { version: event.version, venue: null })
      .expect(422);
    expect(venue.body.code).toBe('required_when_live');
    const last = await as(owner)
      .delete(`${events()}/${event.id}/ticket-types/${event.ticketTypes[0]!.id}`)
      .expect(409);
    expect(last.body.code).toBe('last_ticket_type');
  });

  it('browses upcoming events by city and time window, soonest first', async () => {
    const soon = await publish(
      await publishable({
        startsAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
      }),
    );
    const later = await publish(
      await publishable({
        startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
        endsAt: new Date(Date.now() + 10 * DAY + HOUR).toISOString(),
      }),
    );
    const melbourne = await publish(
      await publishable({ venue: { ...sydneyPlace, city: 'melbourne', suburb: 'Fitzroy' } }),
    );

    const sydney = await browseAll({ city: 'sydney' });
    expect(sydney).toEqual(expect.arrayContaining([soon.slug, later.slug]));
    expect(sydney).not.toContain(melbourne.slug);
    expect(sydney.indexOf(soon.slug!)).toBeLessThan(sydney.indexOf(later.slug!));
    expect(await browseAll({ city: 'melbourne' })).toContain(melbourne.slug);

    const week = await browseAll({ city: 'sydney', when: 'next_7_days' });
    expect(week).toContain(soon.slug);
    expect(week).not.toContain(later.slug);

    expect(await browseAll({ city: 'sydney', price: 'paid' })).not.toContain(soon.slug);
    expect(await browseAll({ city: 'sydney', price: 'free' })).toContain(soon.slug);

    const card = (await anon().get('/public/events').query({ city: 'sydney', limit: '50' })).body
      .items[0];
    expect(Object.keys(card).sort()).toEqual(
      [
        'banner',
        'name',
        'online',
        'priceFromAllInCents',
        'slug',
        'startsAt',
        'suburb',
        'template',
        'timeZone',
        'venueName',
      ].sort(),
    );
  });

  it('shows the same "from" price on the browse card and the event page', async () => {
    const live = await publish(await publishable());
    const path = `${events()}/${live.id}`;
    const ticket = { ...live.ticketTypes[0]!, id: undefined, sold: undefined, name: 'VIP' };
    const withVip = await as(owner).post(`${path}/ticket-types`, ticket).expect(201);
    // Paid tickets are off in the api, so set prices the way Sprint 4's flag will allow.
    await withOwner((client) =>
      client.query(
        `update catalogue.ticket_types set price_cents = case name when 'VIP' then 4500 else 1200 end,
           -- The cheaper type isn't on sale yet: "from" still counts it, on the card and the page.
           sales_start = case name when 'VIP' then sales_start
             else jsonb_build_object('kind', 'at', 'at', now() + interval '2 days') end
          where event_id = $1`,
        [withVip.body.id],
      ),
    );
    const page = await anon().get(`/public/events/${live.slug}`).expect(200);
    const card = async (price?: string) => {
      const slugs: { slug: string; priceFromAllInCents: number }[] = [];
      let cursor: string | null = null;
      do {
        const response: request.Response = await anon()
          .get('/public/events')
          .query({ limit: '50', ...(price ? { price } : {}), ...(cursor ? { cursor } : {}) })
          .expect(200);
        slugs.push(...response.body.items);
        cursor = response.body.nextCursor;
      } while (cursor);
      return slugs.find((item) => item.slug === live.slug);
    };
    expect(page.body.ticketTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ allInPriceCents: 1200, onSale: false }),
        expect.objectContaining({ allInPriceCents: 4500, onSale: true }),
      ]),
    );
    expect(page.body.priceFromAllInCents).toBe(1200);
    expect((await card())?.priceFromAllInCents).toBe(1200);
    expect(await card('paid')).toBeDefined();
    expect(await card('free')).toBeUndefined();
  });

  it('pages browse results with a cursor', async () => {
    await publish(await publishable());
    await publish(await publishable());
    const first = await anon().get('/public/events').query({ limit: '1' }).expect(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await anon()
      .get('/public/events')
      .query({ limit: '1', cursor: first.body.nextCursor })
      .expect(200);
    expect(second.body.items[0].slug).not.toBe(first.body.items[0].slug);
    await anon().get('/public/events').query({ cursor: 'nonsense' }).expect(422);
  });

  it('lets a draft clear fields, but not what a live event needs', async () => {
    const event = await publishable();
    const cleared = await as(owner)
      .patch(`${events()}/${event.id}`, {
        version: event.version,
        name: null,
        startsAt: null,
        contactEmail: null,
      })
      .expect(200);
    expect(cleared.body).toMatchObject({ name: null, startsAt: null, contactEmail: null });

    const live = await publish(await publishable());
    const refused = await as(owner)
      .patch(`${events()}/${live.id}`, { version: live.version, startsAt: null })
      .expect(422);
    expect(refused.body).toMatchObject({ code: 'required_when_live', field: 'startsAt' });
  });

  it("uses the publisher's email as the contact when none was given", async () => {
    const event = await publishable({ contactEmail: null });
    const live = await publish(event);
    expect(live.contactEmail).toMatch(/^owner-.*@example\.test$/);
    const { body } = await anon().get(`/public/events/${live.slug}`).expect(200);
    expect(body.hasContactEmail).toBe(true);
  });

  it('never puts the online link or contact email in the public projection', async () => {
    const live = await publish(
      await publishable({ venue: { kind: 'online', url: 'https://meet.example.test/room-42' } }),
    );
    const { body } = await anon().get(`/public/events/${live.slug}`).expect(200);
    expect(body).not.toHaveProperty('contactEmail');
    expect(body).not.toHaveProperty('organisationId');
    expect(body.venue).toEqual({ kind: 'online' });
  });

  it('looks up venues for signed-in organisers only', async () => {
    await anon().get('/places/search').query({ q: 'town hall' }).expect(401);
    const search = await as(owner).get('/places/search?q=town%20hall&city=melbourne').expect(200);
    expect(search.body.items).toEqual([
      { placeId: 'fake-fitzroy-town-hall', name: 'Fitzroy Town Hall', address: expect.any(String) },
    ]);
    const place = await as(owner).get('/places/fake-fitzroy-town-hall').expect(200);
    expect(place.body).toMatchObject({ kind: 'place', suburb: 'Fitzroy', city: 'melbourne' });
    expect((await as(owner).get('/places/nope').expect(404)).body.code).toBe('place_not_found');
    await as(owner).get('/places/search?q=a').expect(422);
  });

  describe('banners', () => {
    const photo = () =>
      sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c86432' } })
        .jpeg()
        .withExif({ IFD0: { Copyright: 'priya.sharma@example.com' } })
        .toBuffer();

    it('stores a re-encoded 2:1 WebP without EXIF and replaces it cleanly', async () => {
      const event = await draft();
      const path = `${events()}/${event.id}/banner`;
      const first = await as(owner)
        .put(path, 'image/jpeg', await photo())
        .expect(200);
      expect(first.body.banner).toMatchObject({
        width: 2160,
        height: 1080,
        focus: { x: 0.5, y: 0.5 },
      });
      const url = new URL(first.body.banner.url);
      expect(url.pathname).toMatch(/^\/api\/public\/banners\/[0-9a-f-]{36}\.webp$/);

      const servedPath = url.pathname.replace(/^\/api/, '');
      const served = await anon().get(servedPath).buffer(true).expect(200);
      expect(served.headers['content-type']).toBe('image/webp');
      expect(served.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.from(served.body).includes('priya.sharma')).toBe(false);

      const ogPath = new URL(first.body.banner.ogUrl).pathname.replace(/^\/api/, '');
      expect(ogPath).toBe(servedPath.replace(/\.webp$/, '-og.jpg'));
      const og = await anon().get(ogPath).buffer(true).expect(200);
      expect(og.headers['content-type']).toBe('image/jpeg');
      expect(await sharp(Buffer.from(og.body)).metadata()).toMatchObject({
        width: 1200,
        height: 630,
      });

      const second = await as(owner)
        .put(
          path,
          'image/png',
          await sharp(await photo())
            .png()
            .toBuffer(),
        )
        .expect(200);
      expect(second.body.banner.url).not.toBe(first.body.banner.url);
      await anon().get(servedPath).expect(404);
      await anon().get(ogPath).expect(404);

      await as(owner).delete(path).expect(200);
      await anon()
        .get(new URL(second.body.banner.url).pathname.replace(/^\/api/, ''))
        .expect(404);
    });

    it('refuses other types, fake images and anything over 10 MB', async () => {
      const event = await draft();
      const path = `${events()}/${event.id}/banner`;
      await as(owner).put(path, 'image/svg+xml', Buffer.from('<svg/>')).expect(415);
      const fake = await as(owner)
        .put(path, 'image/jpeg', Buffer.from('<svg onload="alert(1)"/>'))
        .expect(415);
      expect(fake.body.code).toBe('unsupported_image');
      const gif = await as(owner)
        .put(path, 'image/png', Buffer.from('GIF89a\u0001\u0000\u0001\u0000'))
        .expect(415);
      expect(gif.body.code).toBe('unsupported_image');
      const big = await as(owner)
        .put(path, 'image/jpeg', Buffer.alloc(10 * 1024 * 1024 + 1))
        .expect(413);
      expect(big.body.code).toBe('image_too_large');
      await as(door)
        .put(path, 'image/jpeg', await photo())
        .expect(403);
    });

    it('serves only api-made banner keys', async () => {
      await anon().get('/public/banners/..%2F..%2Fetc%2Fpasswd').expect(404);
      await anon().get('/public/banners/not-a-key.webp').expect(404);
    });
  });
});
