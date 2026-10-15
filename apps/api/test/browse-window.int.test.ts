import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventsRepository } from '../src/modules/catalogue/events.repository.js';
import { appDatabaseUrl, seedOrganisation, seedUser, uniqueEmail, withOwner } from './db.js';

// S1-5 (QA 5.4): "tonight" and "this weekend" are worked out in the city's time zone, including
// the weekends Sydney's clocks change. The clock is pinned by passing `now` to the repository,
// which runs as the api's own role, so row-level security applies as it does for browse.
describe('browse time windows in Sydney', () => {
  const repository = new EventsRepository();
  let pool: pg.Pool;
  const ids = new Map<string, string>();

  /** A published one-hour Sydney event starting at `startsAt` (UTC). */
  async function seedEvent(label: string, organisationId: string, startsAt: string) {
    const start = new Date(startsAt);
    const { rows } = await withOwner((client) =>
      client.query<{ id: string }>(
        `insert into catalogue.events
           (organisation_id, template, name, starts_at, ends_at, venue, city, status, slug,
            published_at)
         values ($1, 'gig', $2, $3, $4, $5, 'sydney', 'published', $6, now())
         returning id`,
        [
          organisationId,
          label,
          start,
          new Date(start.getTime() + 60 * 60 * 1000),
          JSON.stringify({
            kind: 'place',
            placeId: 'p',
            name: 'Hall',
            address: '1 Main St',
            suburb: 'Newtown',
            city: 'sydney',
            lat: -33.9,
            lng: 151.2,
          }),
          `${label}-${crypto.randomUUID().slice(0, 8)}`,
        ],
      ),
    );
    ids.set(label, rows[0]!.id);
  }

  async function browse(when: 'tonight' | 'this_weekend' | 'next_7_days', now: string) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rows = await repository.browse(client, {
        city: 'sydney',
        timeZone: 'Australia/Sydney',
        when,
        limit: 1000,
        now: new Date(now),
      });
      const found = new Set(rows.map((row) => row.id));
      return [...ids].filter(([, id]) => found.has(id)).map(([label]) => label);
    } finally {
      await client.query('rollback');
      client.release();
    }
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: appDatabaseUrl() });
    const org = await seedOrganisation('Window Org', [
      { userId: await seedUser(uniqueEmail('window')), role: 'owner' },
    ]);
    // Daylight saving ends Sun 4 Apr 2027 (AEDT +11 to AEST +10).
    await seedEvent('apr-fri-8pm', org, '2027-04-02T09:00:00Z'); // Fri 20:00 AEDT
    await seedEvent('apr-sat-1145pm', org, '2027-04-03T12:45:00Z'); // Sat 23:45 AEDT
    await seedEvent('apr-sun-0015am', org, '2027-04-03T13:15:00Z'); // Sun 00:15 AEDT
    await seedEvent('apr-sun-1130pm', org, '2027-04-04T13:30:00Z'); // Sun 23:30 AEST
    await seedEvent('apr-mon-0030am', org, '2027-04-04T14:30:00Z'); // Mon 00:30 AEST
    // Daylight saving starts Sun 3 Oct 2027 (AEST +10 to AEDT +11).
    await seedEvent('oct-sun-1130pm', org, '2027-10-03T12:30:00Z'); // Sun 23:30 AEDT
    await seedEvent('oct-mon-0030am', org, '2027-10-03T13:30:00Z'); // Mon 00:30 AEDT
  });

  afterAll(async () => {
    await pool.end();
  });

  it('ends "tonight" at local midnight', async () => {
    // Sat 3 Apr 23:30 AEDT.
    expect(await browse('tonight', '2027-04-03T12:30:00Z')).toEqual(['apr-sat-1145pm']);
    // Sun 3 Oct 22:00 AEDT, the night the clocks went forward.
    expect(await browse('tonight', '2027-10-03T11:00:00Z')).toEqual(['oct-sun-1130pm']);
  });

  it('runs "this weekend" from Saturday to Sunday midnight across the April change', async () => {
    // Fri 2 Apr 10:00 AEDT. Monday starts at 00:00 AEST, an hour later in UTC than in AEDT.
    expect(await browse('this_weekend', '2027-04-01T23:00:00Z')).toEqual([
      'apr-sat-1145pm',
      'apr-sun-0015am',
      'apr-sun-1130pm',
    ]);
  });

  it('runs "this weekend" from Saturday to Sunday midnight across the October change', async () => {
    // Fri 1 Oct 10:00 AEST. Monday starts at 00:00 AEDT, an hour earlier in UTC than in AEST.
    expect(await browse('this_weekend', '2027-10-01T00:00:00Z')).toEqual(['oct-sun-1130pm']);
  });

  it('keeps the rest of the weekend once it has started, and drops events already over', async () => {
    // Sun 4 Apr 01:30 AEDT: the events that started before 00:30 have ended.
    expect(await browse('this_weekend', '2027-04-03T14:30:00Z')).toEqual(['apr-sun-1130pm']);
  });

  it('covers exactly the next seven days', async () => {
    // Fri 2 Apr 20:30 AEDT, half an hour into the Friday event.
    expect(await browse('next_7_days', '2027-04-02T09:30:00Z')).toEqual([
      'apr-fri-8pm',
      'apr-sat-1145pm',
      'apr-sun-0015am',
      'apr-sun-1130pm',
      'apr-mon-0030am',
    ]);
    // Seven days before the Monday event starts, it is just out of range.
    expect(await browse('next_7_days', '2027-03-28T14:30:00Z')).toEqual([
      'apr-fri-8pm',
      'apr-sat-1145pm',
      'apr-sun-0015am',
      'apr-sun-1130pm',
    ]);
  });
});
