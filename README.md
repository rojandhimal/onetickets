# OneTickets

Event ticketing for Australian organisers. pnpm workspace monorepo:

| Package           | What it is                                                   |
| ----------------- | ------------------------------------------------------------ |
| `apps/web`        | Next.js site for attendees and organisers                    |
| `apps/api`        | NestJS API, one folder per module under `src/modules`        |
| `apps/scanner`    | Mobile web scanner for door staff (Vite + React)             |
| `packages/shared` | Types and helpers shared by every app (API contracts, money) |

## Getting started

Needs Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`) and Docker for Postgres.

```sh
pnpm install
docker compose up -d
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
DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets pnpm test:integration
pnpm build && DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets pnpm e2e  # browser and accessibility tests
```

E2E tests live in `e2e/` and run every page at 375 px and 1280 px with an axe check for WCAG 2.2 AA.
Run `pnpm --filter @onetickets/e2e exec playwright install chromium` once first.

## Module boundaries

Apps share code only through `packages/*`. Inside the api, a module may import another module
only through its `index.ts`; see [apps/api/src/modules/README.md](apps/api/src/modules/README.md).
`.dependency-cruiser.cjs` enforces both in CI.
