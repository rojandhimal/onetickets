import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Applies apps/api/migrations/*.sql in name order, each in its own transaction, once.
 * Run as the role that owns the schemas (MIGRATION_DATABASE_URL), never as the api's role.
 * Migrations must be backwards-compatible (expand, then contract) so a deploy can roll back.
 */
export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

// Any constant works; it only stops two deploys migrating at once.
const MIGRATION_LOCK_ID = 7_340_001;

export async function migrate(connectionString: string, dir = MIGRATIONS_DIR): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )`);
    const { rows } = await client.query<{ version: string }>(
      'select version from public.schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.version));
    const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();

    const ran: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (version) values ($1)', [file]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }
      ran.push(file);
    }
    return ran;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    console.error('MIGRATION_DATABASE_URL is not set');
    process.exit(1);
  }
  const ran = await migrate(url);
  console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date');
}
