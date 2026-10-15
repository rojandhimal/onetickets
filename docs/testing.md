# Testing

| Layer         | Tool                              | Lives in                               | Command                 |
| ------------- | --------------------------------- | -------------------------------------- | ----------------------- |
| Unit          | Vitest                            | `src/**/*.test.ts(x)` next to the code | `pnpm test`             |
| Integration   | Vitest against real Postgres 16   | `apps/api/test/**/*.int.test.ts`       | `pnpm test:integration` |
| End to end    | Playwright (Chromium)             | `e2e/tests`                            | `pnpm e2e`              |
| Accessibility | `@axe-core/playwright` inside e2e | `e2e/tests/a11y.ts`                    | `pnpm e2e`              |
| Boundaries    | dependency-cruiser                | `.dependency-cruiser.cjs`              | `pnpm lint`             |

Concurrency tests for money and inventory (`apps/api/test/invariants/`) arrive with Sprint 2, and
load tests (`load/`, k6) with Sprint 9.

## Unit tests

Pure logic: money formatting, roles, validation, components. Fast, no database, no network.

```sh
pnpm test                                  # all packages
pnpm --filter @onetickets/api test         # one package
```

## Integration tests

Api endpoints, migrations and row-level security, against a real Postgres. They need Postgres
running (`docker compose up -d postgres mailpit`):

```sh
pnpm test:integration
```

The test setup migrates the database as `onetickets_owner`, which owns the database and can create
roles but is not a superuser, like the RDS master user. A migration that only works as a superuser
fails here, not in staging. The api then runs as `ot_app_test`, a login role with only `ot_app`,
exactly like production; a superuser would skip row-level security and prove nothing. Tests seed
and inspect rows as the `postgres` superuser, because forced row-level security fences the owner
too. `MIGRATION_DATABASE_URL` and `TEST_SUPERUSER_DATABASE_URL` override the two connections; the
defaults match docker compose.

## End-to-end and accessibility tests

Every page is checked at 375 px and 1280 px wide with an axe scan for WCAG 2.2 AA. Any
Content-Security-Policy violation on a page also fails the test, so a report-only violation can't
reach production unnoticed. New specs import `test` and `expect` from `e2e/tests/fixtures.ts`
rather than `@playwright/test` to get that check. It watches every page in the test's own browser
context, across navigations. A context a spec creates itself with `browser.newContext()` isn't
watched.

```sh
pnpm --filter @onetickets/e2e exec playwright install chromium   # once
docker compose up -d postgres
pnpm build
./e2e/setup-db.sh      # migrates and creates the onetickets_app login role (needs psql)
pnpm e2e               # the api connects as onetickets_app unless DATABASE_URL is set
```

## Rules

- Never mock Postgres in integration tests. Each test file starts from a clean state.
- Use fixed clocks for anything time based (holds, sales windows, link expiry). No `sleep` waits;
  Playwright uses web-first assertions.
- A flaky test is a bug. Fix it or find its cause; never skip it or retry it silently.
- Any change to money or inventory needs a test that tries to break its database invariant,
  including with concurrent clients (for example, 50 buyers racing for the last 10 tickets must
  produce exactly 10 holds).
- Test data uses obviously fake people and never real personal data.
- Security regressions stay as tests: cross-organisation reads return nothing, every endpoint is
  checked against each role, QR codes carry no personal data, logs carry no personal data.
