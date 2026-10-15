# OneTickets test strategy

Owner: QA thread. Source of truth for stories and the Definition of Done: [OneTickets MVP Sprint Backlog](https://claude.ai/code/artifact/908caae3-7868-4e89-9a10-4da3f5d376ae).
Last updated: 2026-10-08.

## What "tested" means here

A story passes QA when every acceptance criterion has a check that is either automated in CI or written as a manual step in that sprint's checklist (`qa/sprint-N-checklist.md`), and every check has passed on staging. A criterion with no check fails QA, even if the code looks right.

The Definition of Done adds five checks to every story: tests in CI against real Postgres, 375 px plus keyboard and screen reader (WCAG 2.2 AA), the dependency-cruiser boundary rule, a database invariant test for any money or inventory change, and a feature flag if the story is not ready for organisers. Since 9 Oct (team working agreement, `pm/working-agreement.md`), QA also checks every PR updates the repo docs it affects (README for setup and run steps, `docs/` for modules, flows, endpoints and env vars, `docs/adr/` for decisions) and its description names the story id and how to test locally. A user-visible or setup change with no doc update fails QA.

## Test layers

| Layer         | Tool                                                                          | Lives in                                 | Runs                                                                    | What belongs here                                                                                               |
| ------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unit          | Vitest                                                                        | `src/**/*.test.ts` next to the code      | Every PR (`pnpm test`)                                                  | Pure logic: pricing, money formatting, token signing and verifying, hold expiry maths, role checks              |
| Integration   | Vitest + supertest, real Postgres 16 service container                        | `apps/api/test/**/*.int.test.ts`         | Every PR (`pnpm test:integration`)                                      | API endpoints, migrations, row-level security, database invariants, outbox, webhook handling. No database mocks |
| Concurrency   | Vitest, many parallel connections to real Postgres                            | `apps/api/test/invariants/*.int.test.ts` | Every PR                                                                | Oversell, double check-in, duplicate webhook: run N clients at once and assert the invariant                    |
| End to end    | Playwright (Chromium, plus WebKit for the scanner from Sprint 3)              | `e2e/` at the repo root                  | Every PR against a locally started web and api; nightly against staging | The sprint demo journey and each story's happy path                                                             |
| Accessibility | `@axe-core/playwright` inside the e2e tests, plus a manual screen reader pass | `e2e/`                                   | Every PR (axe); each sprint (manual)                                    | WCAG 2.2 AA at 375 px and 1280 px                                                                               |
| Boundaries    | dependency-cruiser                                                            | `.dependency-cruiser.cjs`                | Every PR (`pnpm lint:boundaries`)                                       | No imports of another module's internals                                                                        |
| Load          | k6                                                                            | `load/`                                  | Sprint 9, then before launch                                            | Big on-sale night, waiting room                                                                                 |

Rules for all layers:

- Integration and invariant tests never mock Postgres. Each test file gets a clean schema (transaction rollback or truncate in `beforeEach`).
- Tests use fixed clocks for anything time based (holds, sales windows, magic link expiry). No `sleep`-based waits; Playwright uses web-first assertions.
- A flaky test is a bug. It gets fixed or its cause found, never skipped or retried silently.
- Test data uses obviously fake people (`priya@example.test`) and never real personal data.

## Money and inventory invariants

The Definition of Done says any change to money or inventory needs a test of its database invariant. Each invariant below is enforced in the database (a constraint, a unique index or a single conditional update), and tested by trying to break it, including with concurrent clients. A test that only checks the happy path does not count.

| #      | Invariant                                                                                   | Enforced by                                                             | How the test breaks it                                                                                                                                                     | First needed |
| ------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| INV-1  | For every ticket type, `sold + held <= capacity` and both are `>= 0`                        | CHECK constraint on the inventory row                                   | 50 parallel buyers for the last 10 tickets: exactly 10 holds succeed, the rest get "sold out"; direct UPDATE past capacity is rejected                                     | S1-2, S2-1   |
| INV-2  | A hold is reserved with one conditional update; zero rows back means sold out               | Single `UPDATE ... WHERE sold + held + qty <= capacity`                 | Assert no read-then-write path exists; race test as INV-1                                                                                                                  | S2-1         |
| INV-3  | Expired holds return their stock exactly once                                               | Sweeper in one transaction per hold                                     | Expire 100 holds, run two sweepers at once: `held` drops by exactly the held quantity, never below 0                                                                       | S2-1         |
| INV-4  | Per-order limit is never exceeded                                                           | CHECK or service guard plus test                                        | Request limit + 1 tickets, and two concurrent requests with the same idempotency key                                                                                       | S1-2, S2-2   |
| INV-5  | Same idempotency key returns the same order and creates no second order or hold             | Unique index on idempotency key                                         | Submit the same checkout twice in parallel: one order row                                                                                                                  | S2-2         |
| INV-6  | One active check-in per ticket                                                              | Partial unique index                                                    | Two gates scan the same ticket at once, online and after offline sync: one check-in, the other is amber                                                                    | S3-2, S3-3   |
| INV-7  | An order is paid exactly once                                                               | Unique PaymentIntent id                                                 | Deliver `payment_intent.succeeded` twice, and twice in parallel: one paid order, one set of tickets, one journal                                                           | S4-4         |
| INV-8  | Every ledger journal balances (sum of debits = sum of credits) and journals are append only | Deferred constraint trigger; no UPDATE or DELETE grant on ledger tables | Post an unbalanced journal: transaction fails. Attempt UPDATE on a posted line: permission denied                                                                          | S4-4, S5-3   |
| INV-9  | Paid order, hold conversion, ticket issue and journal happen in one transaction             | Single transaction                                                      | Inject a failure after each step: nothing is half written                                                                                                                  | S4-4         |
| INV-10 | Money is whole cents, never floats; one pricing function is the only source of fees         | `Cents` integer type, `bigint` columns, a lint rule or import check     | Property test: for many prices, buyer total = ticket + fee + processing + GST and organiser net + platform revenue = buyer total, all integers. A$50 Starter shows A$53.35 | S4-2         |
| INV-11 | Refunds never exceed what was paid, and each refund posts a reversing journal               | CHECK on cumulative refunds; reversing entries only                     | Refund the same order twice in parallel; partial refunds summing past the total                                                                                            | S5-3, S5-4   |
| INV-12 | A refunded or revoked ticket scans red, online and offline                                  | Revocation list                                                         | Refund, then scan online and from an offline download taken after the refund                                                                                               | S5-3         |
| INV-13 | A disputed event's payout cannot be released                                                | Payout status guard                                                     | Open a dispute, then try to release the payout                                                                                                                             | S5-5, S7     |
| INV-14 | Settlement reconciles: payouts + fees + refunds + disputes equals charges for every event   | Reconciliation query                                                    | Seed a full event lifecycle and assert the totals match Stripe test-mode balances                                                                                          | S7           |
| INV-15 | Waiting room never shows "sold out" while tickets are only held (ARCH-2)                    | Sold-out check uses `sold`, not `sold + held`                           | Hold the last tickets without paying: waiting room still says "check back", not "sold out"                                                                                 | S9-1         |

## Security and privacy checks that QA owns

- Row-level security: a user from org A gets zero rows from every org-scoped table for org B, through the API and with a direct database session as the app role (S0-4).
- Role matrix: every endpoint is called as owner, admin, finance, door staff and anonymous, and the result is compared with an expected table (S0-4, S3-1).
- QR tokens carry no name or email, and a token signed with another event's key is rejected (S2-3).
- Logs: a test request with a known email, phone and name produces logs where none of them appear in clear text (S0-5).
- Card data never touches our servers: no request body to our API contains a PAN pattern (S4-3).

The Security reviewer thread, if created, goes deeper; QA keeps these as regression tests.

## Launch-readiness checks

Checked on production config before public launch, not in sprint QA.

| #   | Check                                                                                                                                                                                       | How                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1 | Sign-in abuse (SEC-10): `MAGIC_LINK_HOURLY_CAP` set well above real peak, an alarm fires on the cap warning, and Cloudflare rate limiting plus Turnstile sit in front of `/auth/magic-link` | Read prod config; trigger the cap warning on staging with a low cap and confirm the alarm; send a burst through Cloudflare and confirm it is challenged or blocked before the api |
| L-2 | `TRUST_PROXY_HOPS` matches the real proxy chain, and the load balancer appends (not preserves) `X-Forwarded-For`, so per-IP limits see the real client                                      | On staging, send requests with a spoofed `X-Forwarded-For` and confirm the per-IP limit still trips                                                                               |
| L-3 | Session cookie is `__Host-` prefixed and `Secure` over https                                                                                                                                | Inspect the cookie on staging                                                                                                                                                     |

## Accessibility

- Every e2e page visit runs axe with WCAG 2.2 A and AA tags at 375 px and 1280 px. Any violation fails the test.
- Each sprint, QA does a manual pass on new screens: keyboard only (tab order, visible focus, no traps), VoiceOver on iOS Safari at 375 px, and target size of at least 24 by 24 px.
- The 24 issues from the design accessibility audit are regression checks on the screens they apply to.

## Environments and data

- PR: local web and api plus a Postgres 16 service container in GitHub Actions.
- Staging: the nightly Playwright run and the sprint demo run. Seeded with a fixed demo organisation and fake attendees.
- Third parties in tests: Google OAuth via a test client on staging and a stub provider locally; email via a local mail catcher (Mailpit) locally and SES sandbox on staging; Stripe in test mode only.

## How QA works each sprint

1. At planning, QA turns every acceptance criterion into checks in `qa/sprint-N-checklist.md` and marks which are automated.
2. On each draft PR, QA reviews against those checks and the Definition of Done, and comments on the PR with what is missing, including any doc update the change needs. QA adds tests on a dev's branch only if that dev agrees, and never merges.
3. When a story's checks all pass on staging, QA tells PM it passed. A failure goes to PM and the dev with the failing check and how to reproduce it.
4. Before the demo, QA runs the demo journey end to end on staging and reports the result to PM.
