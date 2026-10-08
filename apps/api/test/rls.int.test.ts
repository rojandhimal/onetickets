import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appDatabaseUrl, seedOrganisation, seedUser, uniqueEmail } from './db.js';

// S0-4: Postgres row-level security blocks reads across organisations. Runs as the real app
// role (see db.ts), so a pass here means the policies hold for the api itself.
describe('row-level security across organisations', () => {
  let pool: pg.Pool;
  let aliceId: string;
  let bobId: string;
  let orgA: string;
  let orgB: string;

  async function asTenant<T>(
    scope: { organisationId?: string; userId?: string },
    work: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        "select set_config('app.organisation_id', $1, true), set_config('app.user_id', $2, true)",
        [scope.organisationId ?? '', scope.userId ?? ''],
      );
      return await work(client);
    } finally {
      await client.query('rollback');
      client.release();
    }
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: appDatabaseUrl() });
    aliceId = await seedUser(uniqueEmail('alice'));
    bobId = await seedUser(uniqueEmail('bob'));
    orgA = await seedOrganisation('Org A', [{ userId: aliceId, role: 'owner' }]);
    orgB = await seedOrganisation('Org B', [{ userId: bobId, role: 'owner' }]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('runs as a role that cannot bypass row-level security', async () => {
    const { rows } = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      'select rolsuper, rolbypassrls from pg_roles where rolname = current_user',
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('sees only the current organisation', async () => {
    const seen = await asTenant({ organisationId: orgA }, async (client) => ({
      organisations: (await client.query('select id from identity.organisations')).rows,
      memberships: (await client.query('select organisation_id from identity.memberships')).rows,
      users: (await client.query('select id from identity.users')).rows,
    }));
    expect(seen.organisations).toEqual([{ id: orgA }]);
    expect(seen.memberships).toEqual([{ organisation_id: orgA }]);
    expect(seen.users).toEqual([{ id: aliceId }]);
  });

  it('returns nothing when asked for another organisation by id', async () => {
    const rows = await asTenant({ organisationId: orgA }, async (client) => {
      const orgs = await client.query('select * from identity.organisations where id = $1', [orgB]);
      const members = await client.query(
        'select * from identity.memberships where organisation_id = $1',
        [orgB],
      );
      const users = await client.query('select * from identity.users where id = $1', [bobId]);
      return [...orgs.rows, ...members.rows, ...users.rows];
    });
    expect(rows).toEqual([]);
  });

  it('returns nothing when no organisation is set', async () => {
    const count = await asTenant({}, async (client) => {
      const { rows } = await client.query<{ n: number }>(
        `select (select count(*) from identity.organisations)
              + (select count(*) from identity.memberships)
              + (select count(*) from identity.users) as n`,
      );
      return Number(rows[0]!.n);
    });
    expect(count).toBe(0);
  });

  it('cannot change another organisation', async () => {
    const updated = await asTenant({ organisationId: orgA }, async (client) => {
      const orgs = await client.query(
        `update identity.organisations set name = 'hacked' where id = $1`,
        [orgB],
      );
      const members = await client.query(
        `update identity.memberships set role = 'door_staff' where organisation_id = $1`,
        [orgB],
      );
      const deleted = await client.query(
        'delete from identity.memberships where organisation_id = $1',
        [orgB],
      );
      return orgs.rowCount! + members.rowCount! + deleted.rowCount!;
    });
    expect(updated).toBe(0);
  });

  it('cannot add itself to another organisation', async () => {
    await expect(
      asTenant({ organisationId: orgA, userId: aliceId }, (client) =>
        client.query(
          `insert into identity.memberships (organisation_id, user_id, role) values ($1, $2, 'owner')`,
          [orgB, aliceId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lists a user's own organisations without exposing other members", async () => {
    const seen = await asTenant({ userId: aliceId }, async (client) => ({
      organisations: (await client.query('select id from identity.organisations')).rows,
      memberships: (await client.query('select user_id from identity.memberships')).rows,
    }));
    expect(seen.organisations).toEqual([{ id: orgA }]);
    expect(seen.memberships).toEqual([{ user_id: aliceId }]);
  });
});
