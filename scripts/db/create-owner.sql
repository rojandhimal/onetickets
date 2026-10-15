-- Makes local and CI Postgres match RDS: migrations run as onetickets_owner, which owns the
-- database and can create roles and databases but is not a superuser. RDS's master user is
-- the same (CREATEROLE, CREATEDB, member of rds_superuser), so a migration that needs a real
-- superuser, such as ALTER ... OWNER to a role it isn't a member of, fails here as it would there.
--
-- Run once against a fresh server as its bootstrap superuser:
--   docker compose: mounted into /docker-entrypoint-initdb.d, so it runs on the first start
--   CI: psql "postgres://postgres:postgres@localhost:5432/postgres" -f scripts/db/create-owner.sql
\set ON_ERROR_STOP on
create role onetickets_owner login password 'onetickets_owner' createdb createrole nosuperuser nobypassrls;
create database onetickets owner onetickets_owner;
