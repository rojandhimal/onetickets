# OneTickets

Event ticketing for Australian organisers: publish an event, sell or give away tickets, and check
people in at the door with a phone. Think Eventbrite, built for small and mid-sized Australian
events, with prices shown including GST and payouts through Stripe Connect.

**Status:** Sprint 0 (foundations). Organiser sign-up screens, organisations and roles are in
`main`. Sign-in (the auth API) is being built now. Public launch is planned for May 2027 in Sydney
and Melbourne. See the [roadmap](docs/roadmap.md).

## What's in the repo

This is a pnpm workspace monorepo.

| Package           | What it is                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `apps/web`        | Next.js site for attendees and organisers (port 3000)               |
| `apps/api`        | NestJS API, one folder per module under `src/modules` (port 3001)   |
| `apps/scanner`    | Mobile web scanner for door staff, Vite + React (port 3002), a stub |
| `packages/shared` | Types and helpers every app uses (API contracts, roles, money)      |

## Run it locally

Everything runs on your own machine with Docker for now. There is no shared staging site yet;
staging and production on AWS come later (see [environments](docs/environments.md)).

You need Node 22 (see `.nvmrc`), pnpm 10 (`corepack enable`) and Docker Desktop.

```sh
pnpm install
docker compose up -d                    # Postgres 16
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @onetickets/shared build
```

Then migrate the database, create the api's login role and start the apps. The full steps, and
what to do when something goes wrong, are in [docs/local-development.md](docs/local-development.md).

## Checks

CI runs these on every pull request. Run them before you push.

```sh
pnpm format:check
pnpm lint              # ESLint, module boundaries, and a self-test of the boundary rule
pnpm typecheck
pnpm test              # unit tests
MIGRATION_DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets pnpm test:integration
pnpm build && ./e2e/setup-db.sh && pnpm e2e  # browser and accessibility tests
```

E2E tests live in `e2e/` and run every page at 375 px and 1280 px with an axe check for WCAG 2.2 AA.
Run `pnpm --filter @onetickets/e2e exec playwright install chromium` once first. `e2e/setup-db.sh`
migrates and creates the `onetickets_app` login role the api uses (see `apps/api/.env.example`).

## Database

Migrations are plain SQL in `apps/api/migrations`, applied in order by
`pnpm --filter @onetickets/api migrate` with `MIGRATION_DATABASE_URL` (the schema owner). They must
be backwards-compatible (expand, then contract).

The api connects with `DATABASE_URL` as a login role granted `ot_app`, never as the owner or a
superuser: every tenant table has row-level security keyed to the organisation set per transaction
by `UnitOfWork`. Background jobs use a role granted `ot_worker`.

## Module boundaries

Apps share code only through `packages/*`. Inside the api, a module may import another module
only through its `index.ts`; see [apps/api/src/modules/README.md](apps/api/src/modules/README.md).
`.dependency-cruiser.cjs` enforces both in CI.

## Documentation

| Doc                                              | Read it when                                               |
| ------------------------------------------------ | ---------------------------------------------------------- |
| [Local development](docs/local-development.md)   | Setting up your machine, running the apps, troubleshooting |
| [Architecture](docs/architecture.md)             | You need to know how the pieces fit and why                |
| [Contributing](CONTRIBUTING.md)                  | Opening a branch or pull request                           |
| [Testing](docs/testing.md)                       | Writing or running tests                                   |
| [Security checklist](docs/security/checklist.md) | Touching auth, roles, personal data, money or secrets      |
| [Environments](docs/environments.md)             | Asking "where does this run?"                              |
| [Roadmap](docs/roadmap.md)                       | Asking "what's being built, and when?"                     |
| [Decisions (ADRs)](docs/adr/README.md)           | Asking "why did we do it this way?"                        |
