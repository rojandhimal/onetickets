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
import { seedOrganisation, seedUser, uniqueEmail } from './db.js';

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
    const event = await publishable();
    const slugs = await browseAll({ city: 'sydney' });
    expect(slugs.length).toBeGreaterThanOrEqual(0);
    const all = await anon().get('/public/events').query({ limit: '50' }).expect(200);
    expect(JSON.stringify(all.body)).not.toContain(event.id);
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

    const sydneyDate = (d: Date) => d.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' });
    const tonight = await browseAll({ city: 'sydney', when: 'tonight' });
    expect(tonight).not.toContain(later.slug);
    if (sydneyDate(new Date(soon.startsAt!)) === sydneyDate(new Date())) {
      expect(tonight).toContain(soon.slug);
    }

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
