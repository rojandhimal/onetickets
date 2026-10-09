import { migrate } from '../src/database/migrate.js';
import { APP_TEST_ROLE, migrationDatabaseUrl, withOwner } from './db.js';

export default async function setup(): Promise<void> {
  await migrate(migrationDatabaseUrl());
  await withOwner(async (client) => {
    await client.query(`do $$
      begin
        if not exists (select from pg_roles where rolname = '${APP_TEST_ROLE}') then
          create role ${APP_TEST_ROLE} login password '${APP_TEST_ROLE}' nosuperuser nobypassrls;
        end if;
      end
    $$`);
    await client.query(`grant ot_app to ${APP_TEST_ROLE}`);
  });
}
