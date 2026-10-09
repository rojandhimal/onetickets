# Local development

OneTickets runs entirely on your own machine for now. Postgres runs in Docker; the web app, api and
scanner run with pnpm. There is no shared staging site yet (see [environments](environments.md)).

> **Just want to see it running?** Follow [run-locally.md](run-locally.md): install Docker
> Desktop, clone, and `docker compose up --build` starts web, api, Postgres, migrations and a local
> mail inbox in one go. This page is for developing: Postgres in Docker, apps from source with hot
> reload.

## What you need

| Tool           | Version       | How to get it                                 |
| -------------- | ------------- | --------------------------------------------- |
| Node.js        | 22 (`.nvmrc`) | `nvm install` in the repo root, or nodejs.org |
| pnpm           | 10            | `corepack enable` (ships with Node)           |
| Docker Desktop | any recent    | docker.com; it runs Postgres                  |
| Git            | any recent    |                                               |

## First-time setup

From the repo root:

```sh
pnpm install
docker compose up -d postgres           # Postgres 16 on localhost:5432 (not web/api: they'd take ports 3000 and 3001)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @onetickets/shared build  # the apps import the built shared package
```

### Create the database schema

Migrations run as the schema owner (`onetickets`, the Postgres superuser in Docker):

```sh
MIGRATION_DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets \
  pnpm --filter @onetickets/api migrate
```

### Create the api's login role

The api must not connect as a superuser, because superusers skip row-level security. It connects
as `onetickets_app`, a login role that only has the `ot_app` group role. Create it once:

```sh
docker compose exec -T postgres psql -U onetickets -d onetickets -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select from pg_roles where rolname = 'onetickets_app') then
    create role onetickets_app login password 'onetickets_app' nosuperuser nobypassrls;
  end if;
end
$$;
grant ot_app to onetickets_app;
SQL
```

Run migrations before this step: they create `ot_app`.

## Running the apps

Use one terminal per app.

```sh
# api on http://localhost:3001 (check http://localhost:3001/health)
pnpm --filter @onetickets/api build
node --env-file=apps/api/.env apps/api/dist/main.js

# web on http://localhost:3000
pnpm --filter @onetickets/web dev

# scanner on http://localhost:3002 (a placeholder until Sprint 3)
pnpm --filter @onetickets/scanner dev
```

The browser only talks to the web app. Next.js forwards `/api/*` to the api at `API_URL`, so the
session cookie stays first-party.

Signing in end to end needs the auth API (story S0-3), which is still being built. Until it is
merged, the sign-up screens render but the magic-link step will not complete, and opening
`/organiser` returns a 500 (`GET /me failed with 404` from `apps/web/src/lib/session.ts`) instead
of redirecting to sign-in.

## Environment variables

| Variable                 | Used by     | Local value                                                          |
| ------------------------ | ----------- | -------------------------------------------------------------------- |
| `DATABASE_URL`           | api         | `postgres://onetickets_app:onetickets_app@localhost:5432/onetickets` |
| `MIGRATION_DATABASE_URL` | api migrate | `postgres://onetickets:onetickets@localhost:5432/onetickets`         |
| `PORT`                   | api         | `3001`                                                               |
| `API_URL`                | web         | `http://localhost:3001`                                              |
| `FEATURE_EVENT_WIZARD`   | web         | unset (off). Set to `true` to show the create-event wizard           |

The api's full list, including the sign-in settings, is in
[docs/backend/environment.md](backend/environment.md).

Never commit a real secret. `.env` files are git-ignored, and CI scans every change for secrets.

## Day to day

```sh
pnpm format            # fix formatting
pnpm lint              # ESLint and module boundaries
pnpm typecheck
pnpm test              # unit tests
MIGRATION_DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets pnpm test:integration
```

Add a migration by creating the next numbered file in `apps/api/migrations` (for example
`0002_catalogue.sql`) and running the migrate command again. Each file runs once, in its own
transaction.

## Troubleshooting

**`DATABASE_URL is not set` when starting the api.** Start it with `--env-file=apps/api/.env` as
above; the api does not load `.env` by itself.

**`password authentication failed for user "onetickets_app"`.** The login role does not exist
yet. Run the "Create the api's login role" step.

**`role "ot_app" does not exist`.** Migrations have not run. Run them, then create the login role.

**Port 5432 is already in use.** Another Postgres is running on your machine. Stop it, or change
the left-hand port in `docker-compose.yml` and in both database URLs.

**Cannot find module `@onetickets/shared`.** Run `pnpm --filter @onetickets/shared build`. Re-run
it after changing anything in `packages/shared`.

**Start again with an empty database.** `docker compose down -v` deletes the data volume. Then
repeat the migrate and login-role steps.
