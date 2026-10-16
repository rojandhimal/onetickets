import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { toPlainLine } from '../src/text/plain-text.js';
import { seedOrganisation, withMigrator, withOwner } from './db.js';

// Migration 0007 repeats toPlainLine in SQL to clean organisation names stored before the api
// cleaned them. These check that it runs as the (non-superuser) migration role under FORCE RLS,
// that it really changes the rows, and that the SQL copy gives the same answers as the api.
const migration = readFile(
  new URL('../migrations/0007_clean_organisation_names.sql', import.meta.url),
  'utf8',
);

const samples = [
  'QA <b>Print</b> Club',
  '<p>Bring <b>clay</b></p><script>alert(1)</script><!-- hi -->',
  '<img src=x onerror=alert(1)>Hello',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<<b>img src=x onerror=alert(1)>Hi',
  '<img src=x onerror=alert(1)//',
  '<​script>alert(1)</‮script>',
  '<<<a>a>a>x',
  '<!-<!---->->Hi',
  '<!<!-- -->-- --><?php ?></>',
  'Kids < 12 free & adults > 18 pay <3',
  '  Tom’s\r\n\tGigs \u0007 ',
  'Line one\n\n\n\nLine two',
  'Ünïcödé — café',
  '<b></b>',
];

/** The same seeded mix of markup characters the unit test fuzzes with. */
function fuzz(count: number): string[] {
  const alphabet = ['<', '>', '/', '!', '?', '-', 's', 'b', ' ', '​', '\n', '<!--', '-->'];
  let seed = 7;
  const next = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31);
  return Array.from({ length: count }, () =>
    Array.from({ length: next() % 24 }, () => alphabet[next() % alphabet.length]).join(''),
  );
}

describe('migration 0007: organisation names as plain text', () => {
  it('gives the same answer as the api for every sample and 2,000 fuzzed strings', async () => {
    const sql = await migration;
    const createFunction = sql.slice(0, sql.indexOf('create policy backfill'));
    const inputs = [...samples, ...fuzz(2_000)];
    const inSql = await withMigrator(async (client) => {
      await client.query('begin');
      try {
        await client.query(createFunction);
        const { rows } = await client.query<{ clean: string }>(
          'select pg_temp.plain_line(input) as clean from unnest($1::text[]) with ordinality as i (input, n) order by n',
          [inputs],
        );
        return rows.map((row) => row.clean);
      } finally {
        await client.query('rollback');
      }
    });
    expect(inSql).toEqual(inputs.map(toPlainLine));
  });

  it('cleans stored names as the migration role, and leaves clean ones alone', async () => {
    const dirty = await seedOrganisation('QA <b>Print</b>\n Club', []);
    const onlyMarkup = await seedOrganisation('<i></i>', []);
    const clean = await seedOrganisation('Clay Collective', []);
    const before = await names([clean]);

    await withMigrator(async (client) => {
      await client.query('begin');
      await client.query(await migration);
      await client.query('commit');
    });

    expect(await names([dirty, onlyMarkup])).toEqual(['QA Print Club', 'Unnamed organisation']);
    expect(await names([clean])).toEqual(before);
    const { rows } = await withOwner((client) =>
      client.query<{ policies: number }>(
        `select count(*)::int as policies from pg_policies
          where schemaname = 'identity' and tablename = 'organisations' and policyname = 'backfill'`,
      ),
    );
    expect(rows[0]!.policies).toBe(0);
  });
});

async function names(ids: string[]): Promise<string[]> {
  const { rows } = await withOwner((client) =>
    client.query<{ name: string; id: string }>(
      'select id, name from identity.organisations where id = any($1)',
      [ids],
    ),
  );
  return ids.map((id) => rows.find((row) => row.id === id)!.name);
}
