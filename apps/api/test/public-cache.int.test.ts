import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EventDraftDto } from '@onetickets/shared';
import type { NextFunction, Response } from 'express';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PublicPageRevalidator } from '../src/modules/catalogue/revalidation.js';
import type { AppRequest } from '../src/modules/identity/index.js';
import { seedOrganisation, seedUser, uniqueEmail } from './db.js';

const HOUR = 60 * 60 * 1000;
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

/** Records which live pages the api said had changed. */
class RecordingRevalidator extends PublicPageRevalidator {
  slugs: string[] = [];
  changed(slug: string): void {
    this.slugs.push(slug);
  }
}

// QA 3.2: public pages are cached for a short time, and publishing or editing a live event tells
// the web app to drop its copy. Nothing else the api sends may be cached.
describe('public caching and revalidation', () => {
  let app: INestApplication;
  let owner: string;
  let org: string;
  const revalidator = new RecordingRevalidator();

  const anon = () => request(app.getHttpServer());
  const events = () => `/organisations/${org}/events`;
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

  async function publishable(): Promise<EventDraftDto> {
    const { body: event } = await as(owner).post(events(), { template: 'workshop' }).expect(201);
    const startsAt = new Date(Date.now() + 72 * HOUR);
    const { body } = await as(owner)
      .patch(`${events()}/${event.id}`, {
        version: event.version,
        name: 'Pottery for beginners',
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
        contactEmail: 'hello@example.test',
      })
      .expect(200);
    return body as EventDraftDto;
  }

  async function live(): Promise<EventDraftDto> {
    const event = await publishable();
    const { body } = await as(owner).post(`${events()}/${event.id}/publish`).expect(200);
    return body as EventDraftDto;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PublicPageRevalidator)
      .useValue(revalidator)
      .compile();
    app = moduleRef.createNestApplication();
    app.use((req: AppRequest, _res: Response, next: NextFunction) => {
      const userId = req.header('x-test-user');
      if (userId) req.auth = { userId, mfaVerified: false };
      next();
    });
    await app.init();
    owner = await seedUser(uniqueEmail('cache-owner'));
    org = await seedOrganisation('Cache Org', [{ userId: owner, role: 'owner' }]);
  });

  beforeEach(() => {
    revalidator.slugs = [];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets shared caches keep a live event page and browse for a minute', async () => {
    const event = await live();
    const page = await anon().get(`/public/events/${event.slug}`).expect(200);
    expect(page.headers['cache-control']).toBe(PUBLIC_CACHE);
    const browse = await anon().get('/public/events').expect(200);
    expect(browse.headers['cache-control']).toBe(PUBLIC_CACHE);
  });

  it('never caches a miss, an error or anything private', async () => {
    const missing = await anon().get('/public/events/no-such-event').expect(404);
    expect(missing.headers['cache-control']).toBe('no-store');
    const invalid = await anon().get('/public/events').query({ limit: '0' }).expect(422);
    expect(invalid.headers['cache-control']).toBe('no-store');
    const drafts = await as(owner).get(events()).expect(200);
    expect(drafts.headers['cache-control']).toBe('no-store');
    const signedOut = await anon().get(events()).expect(401);
    expect(signedOut.headers['cache-control']).toBe('no-store');
    const health = await anon().get('/health/live').expect(200);
    expect(health.headers['cache-control']).toBe('no-store');
    // A banner not there yet (or a bad key) must not be cached at the edge as gone.
    for (const key of ['6f1c2a5e-8b3d-4f7a-9c10-2d3e4f5a6b7c.webp', 'not-a-key.png']) {
      const banner = await anon().get(`/public/banners/${key}`).expect(404);
      expect(banner.headers['cache-control']).toBe('no-store');
    }
  });

  it('says nothing while an event is a draft', async () => {
    const event = await publishable();
    await as(owner)
      .post(`${events()}/${event.id}/ticket-types`, {
        name: 'VIP',
        capacity: 10,
        maxPerOrder: 2,
        priceCents: 0,
        salesStart: { kind: 'on_publish' },
        salesEnd: { kind: 'event_start' },
      })
      .expect(201);
    expect(revalidator.slugs).toEqual([]);
  });

  it('revalidates the page on publish and on every change to a live event', async () => {
    const event = await live();
    expect(revalidator.slugs).toEqual([event.slug]);

    const path = `${events()}/${event.id}`;
    const edited = await as(owner)
      .patch(path, { version: event.version, name: 'Pottery for everyone' })
      .expect(200);
    const type = edited.body.ticketTypes[0];
    const ticket = {
      name: 'Early bird',
      capacity: type.capacity,
      maxPerOrder: type.maxPerOrder,
      priceCents: 0,
      salesStart: type.salesStart,
      salesEnd: type.salesEnd,
    };
    const added = await as(owner).post(`${path}/ticket-types`, ticket).expect(201);
    const extra = added.body.ticketTypes.find((t: { name: string }) => t.name === 'Early bird');
    await as(owner)
      .patch(`${path}/ticket-types/${extra.id}`, { ...ticket, capacity: 5, maxPerOrder: 2 })
      .expect(200);
    await as(owner).delete(`${path}/ticket-types/${extra.id}`).expect(200);
    const banner = await sharp({
      create: { width: 1200, height: 600, channels: 3, background: '#c86432' },
    })
      .jpeg()
      .toBuffer();
    await as(owner).put(`${path}/banner`, 'image/jpeg', banner).expect(200);
    await as(owner).delete(`${path}/banner`).expect(200);
    expect(revalidator.slugs).toEqual(Array(7).fill(event.slug));
  });

  it('says nothing when a change to a live event is refused', async () => {
    const event = await live();
    revalidator.slugs = [];
    await as(owner)
      .patch(`${events()}/${event.id}`, { version: event.version - 1, name: 'Stale' })
      .expect(409);
    await as(owner)
      .delete(`${events()}/${event.id}/ticket-types/${event.ticketTypes[0]!.id}`)
      .expect(409);
    expect(revalidator.slugs).toEqual([]);
  });
});
