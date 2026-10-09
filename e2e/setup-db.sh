#!/usr/bin/env bash
# Prepares Postgres for e2e: runs migrations as the schema owner, then creates the login role
# the api connects as (granted ot_app, so row-level security applies, as in production).
set -euo pipefail

: "${MIGRATION_DATABASE_URL:=postgres://onetickets:onetickets@localhost:5432/onetickets}"
export MIGRATION_DATABASE_URL

pnpm --filter @onetickets/api migrate
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
begin
  if not exists (select from pg_roles where rolname = 'onetickets_app') then
    create role onetickets_app login password 'onetickets_app' nosuperuser nobypassrls;
  end if;
end
$$;
grant ot_app to onetickets_app;
SQL
