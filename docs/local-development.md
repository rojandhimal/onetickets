# Running OneTickets locally

OneTickets runs entirely on your own computer for now, with Docker. There is no shared staging site
yet (see [ADR 0014](adr/0014-local-docker-staging-later.md) and [environments](environments.md)).

There are two ways to run it:

- **[Run the whole app](#run-the-whole-app)** with one command. No developer tools needed. Use this
  to try OneTickets or demo it.
- **[Develop](#develop)**: run Postgres and the test inbox in Docker, and the apps from source with
  hot reload. Use this to change the code.

## Run the whole app

You don't need to be a developer for this. It runs the whole app (website, API, database and a
test inbox) on your computer, with no AWS account.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and open it. Wait
   until it says Docker is running.
2. Download the code. Either install [GitHub Desktop](https://desktop.github.com/) and clone
   `rojandhimal/onetickets`, or in a terminal run
   `git clone https://github.com/rojandhimal/onetickets.git`.
3. Open a terminal in the `onetickets` folder (in GitHub Desktop: Repository, then Open in
   Terminal) and run:

   ```sh
   docker compose up --build
   ```

   The first run downloads and builds everything and takes a few minutes. It's ready when the
   messages slow down and you see `Nest application successfully started`. Leave the window open.

4. Open these in your browser:

   | Address                                        | What it is                                                                                         |
   | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
   | [http://localhost:3000](http://localhost:3000) | OneTickets                                                                                         |
   | [http://localhost:8025](http://localhost:8025) | Test inbox: every email the app sends lands here, including sign-in links. Nothing is really sent. |

To stop, press Ctrl+C in the terminal, or click stop in Docker Desktop. Your data is kept for next
time. To pick up new changes, pull the latest code (GitHub Desktop: Fetch origin, then Pull) and
run `docker compose up --build` again. To wipe the database and uploaded images and start fresh, run
`docker compose down -v`.

There is nothing to copy or configure for this. The optional settings are in [`.env.example`](../.env.example).

## Showing it to someone else

Your computer can share the site with a temporary public link through
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/), which is free:

1. Install `cloudflared` ([downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/);
   on a Mac with Homebrew: `brew install cloudflared`).
2. With OneTickets running, open a second terminal and run
   `cloudflared tunnel --url http://localhost:3000`. It prints an address ending in
   `trycloudflare.com`. Anyone with that address can use the site while your computer is on and
   the command is running.
3. So that sign-in links in emails point at the public address, create a file named `.env` in the
   `onetickets` folder containing `WEB_URL=https://<the address it printed>`. Then stop OneTickets
   in the first terminal (Ctrl+C) and run `docker compose up` again.

The address changes every time you start the tunnel, and it stops when your computer sleeps. Only
the website is shared. Emails, including sign-in links, still go to your test inbox and not to the
person, so either sign in yourself and walk them through it, or copy their sign-in link from the
test inbox and send it to them. This is for demos only, not for selling real tickets.

## Develop

### What you need

| Tool           | Version       | How to get it                                   |
| -------------- | ------------- | ----------------------------------------------- |
| Node.js        | 22 (`.nvmrc`) | `nvm install` in the repo root, or nodejs.org   |
| pnpm           | 10            | `corepack enable` (ships with Node)             |
| Docker Desktop | any recent    | docker.com; it runs Postgres and the test inbox |
| Git            | any recent    |                                                 |

### First-time setup

From the repo root:

```sh
pnpm install
docker compose up -d postgres mailpit   # Postgres on :5432 and the test inbox on :8025, not web or api
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @onetickets/shared build  # the apps import the built shared package
```

The api won't start without an MFA key. Put the output of `openssl rand -base64 32` after
`MFA_ENCRYPTION_KEY=` in `apps/api/.env`. Sign-in emails print in the api's terminal by default; to
see them in the test inbox instead, set `MAIL_TRANSPORT=smtp` and uncomment `SMTP_HOST` and
`SMTP_PORT` in the same file.

#### Create the database schema

Migrations run as the schema owner (`onetickets`, the Postgres superuser in Docker):

```sh
MIGRATION_DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets \
  pnpm --filter @onetickets/api migrate
```

#### Create the api's login role

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

### Running the apps

Use one terminal per app.

```sh
# api on http://localhost:3001 (check http://localhost:3001/health)
pnpm --filter @onetickets/api build
node --env-file=apps/api/.env apps/api/dist/main.js

# web on http://localhost:3000
pnpm --filter @onetickets/web dev

# scanner on http://localhost:3002 (a placeholder until Sprint 3)

# test inbox (emails the api sends) on http://localhost:8025
pnpm --filter @onetickets/scanner dev
```

The browser only talks to the web app. Next.js forwards `/api/*` to the api at `API_URL`, so the
session cookie stays first-party.

### Environment variables

| Variable                 | Used by     | Local value                                                          |
| ------------------------ | ----------- | -------------------------------------------------------------------- |
| `DATABASE_URL`           | api         | `postgres://onetickets_app:onetickets_app@localhost:5432/onetickets` |
| `MIGRATION_DATABASE_URL` | api migrate | `postgres://onetickets:onetickets@localhost:5432/onetickets`         |
| `PORT`                   | api         | `3001`                                                               |
| `MFA_ENCRYPTION_KEY`     | api         | your own `openssl rand -base64 32`; the api won't start without it   |
| `API_URL`                | web         | `http://localhost:3001`                                              |
| `FEATURE_EVENT_WIZARD`   | web         | unset (off). Set to `true` to show the create-event wizard           |

The api's full list, including the sign-in settings, is in
[docs/backend/environment.md](backend/environment.md).

Never commit a real secret. `.env` files are git-ignored, and CI scans every change for secrets.

### Day to day

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

### Troubleshooting

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
