import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventsRepository } from '../src/modules/catalogue/events.repository.js';
import { appDatabaseUrl, seedOrganisation, seedUser, uniqueEmail, withOwner } from './db.js';

// S1-5 (QA 5.4): the When chips as design's handoff defines them, in the city's time zone, with a
// night running to 5:00 am, including the weekends Sydney's clocks change. The clock is pinned by passing `now` to the repository,
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

  async function browse(when: 'tonight' | 'this_weekend' | 'next_7_days' | undefined, now: string) {
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
    await seedEvent('apr-thu-6pm', org, '2027-04-01T07:00:00Z'); // Thu 18:00 AEDT
    await seedEvent('apr-fri-4pm', org, '2027-04-02T05:00:00Z'); // Fri 16:00 AEDT
    await seedEvent('apr-fri-6pm', org, '2027-04-02T07:00:00Z'); // Fri 18:00 AEDT
    await seedEvent('apr-sat-1am', org, '2027-04-02T14:00:00Z'); // Sat 01:00 AEDT
    await seedEvent('apr-sat-6am', org, '2027-04-02T19:00:00Z'); // Sat 06:00 AEDT
    await seedEvent('apr-mon-0430', org, '2027-04-04T18:30:00Z'); // Mon 04:30 AEST
    await seedEvent('apr-mon-0530', org, '2027-04-04T19:30:00Z'); // Mon 05:30 AEST
    await seedEvent('apr-fri9-4am', org, '2027-04-08T18:00:00Z'); // Fri 9 Apr 04:00 AEST
    await seedEvent('apr-fri9-6am', org, '2027-04-08T20:00:00Z'); // Fri 9 Apr 06:00 AEST
    // Daylight saving starts Sun 3 Oct 2027 (AEST +10 to AEDT +11).
    await seedEvent('oct-fri-6pm', org, '2027-10-01T08:00:00Z'); // Fri 18:00 AEST
    await seedEvent('oct-mon-0430', org, '2027-10-03T17:30:00Z'); // Mon 04:30 AEDT
    await seedEvent('oct-mon-0530', org, '2027-10-03T18:30:00Z'); // Mon 05:30 AEDT
  });

  afterAll(async () => {
    await pool.end();
  });

  it('shows only events that have not started yet', async () => {
    // Fri 2 Apr 18:30 AEDT: the 6 pm event is under way, so it has gone.
    const upcoming = await browse(undefined, '2027-04-02T07:30:00Z');
    expect(upcoming).not.toContain('apr-fri-6pm');
    expect(upcoming).toContain('apr-sat-1am');
  });

  it('runs "tonight" from 5 pm to 5 am, or from now once the night has started', async () => {
    // Thu 1 Apr 10:00 AEDT: Thu 17:00 to Fri 05:00.
    expect(await browse('tonight', '2027-03-31T23:00:00Z')).toEqual(['apr-thu-6pm']);
    // Sat 3 Apr 00:30 AEDT is still Friday night: now to Sat 05:00, and Friday's 6 pm event
    // has started.
    expect(await browse('tonight', '2027-04-02T13:30:00Z')).toEqual(['apr-sat-1am']);
    // Sun 3 Oct 23:00 AEDT, the night the clocks went forward: now to Mon 05:00 AEDT.
    expect(await browse('tonight', '2027-10-03T12:00:00Z')).toEqual(['oct-mon-0430']);
  });

  it('runs "this weekend" from Friday 5 pm to Monday 5 am across the April change', async () => {
    // Thu 1 Apr 10:00 AEDT: the coming weekend. Monday 05:00 is AEST, an hour later in UTC.
    expect(await browse('this_weekend', '2027-03-31T23:00:00Z')).toEqual([
      'apr-fri-6pm',
      'apr-sat-1am',
      'apr-sat-6am',
      'apr-mon-0430',
    ]);
    // Mon 5 Apr 04:00 AEST is still the weekend: now to 05:00.
    expect(await browse('this_weekend', '2027-04-04T18:00:00Z')).toEqual(['apr-mon-0430']);
  });

  it('runs "this weekend" from Friday 5 pm to Monday 5 am across the October change', async () => {
    // Fri 1 Oct 10:00 AEST. Monday 05:00 is AEDT, an hour earlier in UTC.
    expect(await browse('this_weekend', '2027-10-01T00:00:00Z')).toEqual([
      'oct-fri-6pm',
      'oct-mon-0430',
    ]);
  });

  it('covers today and the next seven days, to 5 am on the eighth', async () => {
    // Thu 1 Apr 10:00 AEDT: up to Fri 9 Apr 05:00 AEST.
    expect(await browse('next_7_days', '2027-03-31T23:00:00Z')).toEqual([
      'apr-thu-6pm',
      'apr-fri-4pm',
      'apr-fri-6pm',
      'apr-sat-1am',
      'apr-sat-6am',
      'apr-mon-0430',
      'apr-mon-0530',
      'apr-fri9-4am',
    ]);
  });
});
