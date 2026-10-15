import pg from 'pg';

/**
 * Integration tests connect three ways:
 * - as the migration role (MIGRATION_DATABASE_URL) to migrate and create the app's login role.
 *   In CI and docker compose that is onetickets_owner, which, like the RDS master user, owns
 *   the database and has CREATEROLE but is not a superuser, so privilege errors show up here;
 * - as a login role that only has ot_app, exactly like the api in production, so row-level
 *   security is really exercised;
 * - as a superuser (TEST_SUPERUSER_DATABASE_URL) to seed and inspect rows. FORCE ROW LEVEL
 *   SECURITY fences the owner too, so only a superuser gets past RLS.
 * Both default to the docker compose Postgres (scripts/db/create-owner.sql).
 */
export const APP_TEST_ROLE = 'ot_app_test';

export function migrationDatabaseUrl(): string {
  return (
    process.env.MIGRATION_DATABASE_URL ||
    'postgres://onetickets_owner:onetickets_owner@localhost:5432/onetickets'
  );
}

export function superuserDatabaseUrl(): string {
  return (
    process.env.TEST_SUPERUSER_DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/onetickets'
  );
}

export function appDatabaseUrl(): string {
  const url = new URL(migrationDatabaseUrl());
  url.username = APP_TEST_ROLE;
  url.password = APP_TEST_ROLE;
  return url.toString();
}

async function withClient<T>(
  connectionString: string,
  work: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Connects as the migration role, with the same privileges the deploy's db-roles task has. */
export function withMigrator<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  return withClient(migrationDatabaseUrl(), work);
}

/** Connects as a superuser, which bypasses RLS, to seed and inspect rows. */
export function withOwner<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  return withClient(superuserDatabaseUrl(), work);
}

/** Seeds rows as the superuser, which bypasses RLS. */
export async function seedUser(email: string): Promise<string> {
  return withOwner(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'insert into identity.users (email) values ($1) returning id',
      [email],
    );
    return rows[0]!.id;
  });
}

export async function seedOrganisation(
  name: string,
  members: { userId: string; role: string }[],
): Promise<string> {
  return withOwner(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'insert into identity.organisations (name) values ($1) returning id',
      [name],
    );
    const id = rows[0]!.id;
    for (const member of members) {
      await client.query(
        'insert into identity.memberships (organisation_id, user_id, role) values ($1, $2, $3)',
        [id, member.userId, member.role],
      );
    }
    return id;
  });
}

export function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}@example.test`;
}
