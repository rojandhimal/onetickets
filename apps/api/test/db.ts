import pg from 'pg';

/**
 * Integration tests connect two ways:
 * - as the migration role (MIGRATION_DATABASE_URL, a superuser in CI) to migrate and seed;
 * - as a login role that only has ot_app, exactly like the api in production, so row-level
 *   security is really exercised. A superuser would bypass RLS and prove nothing.
 */
export const APP_TEST_ROLE = 'ot_app_test';

export function migrationDatabaseUrl(): string {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is not set');
  return url;
}

export function appDatabaseUrl(): string {
  const url = new URL(migrationDatabaseUrl());
  url.username = APP_TEST_ROLE;
  url.password = APP_TEST_ROLE;
  return url.toString();
}

export async function withOwner<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: migrationDatabaseUrl() });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Seeds rows as the owner, which bypasses RLS. */
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
