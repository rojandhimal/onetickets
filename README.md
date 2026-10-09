# OneTickets

Event ticketing for Australian organisers. pnpm workspace monorepo:

| Package           | What it is                                                   |
| ----------------- | ------------------------------------------------------------ |
| `apps/web`        | Next.js site for attendees and organisers                    |
| `apps/api`        | NestJS API, one folder per module under `src/modules`        |
| `apps/scanner`    | Mobile web scanner for door staff (Vite + React)             |
| `packages/shared` | Types and helpers shared by every app (API contracts, money) |

## Getting started

To run the whole app with one command and no developer tools, see
[Run OneTickets on your computer](docs/run-locally.md).

Needs Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`) and Docker for Postgres.

```sh
pnpm install
docker compose up -d postgres mailpit   # just the database and test inbox
cp apps/api/.env.example apps/api/.env
pnpm --filter @onetickets/shared build
```

## Checks

CI runs these on every pull request; run them locally before pushing.

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
