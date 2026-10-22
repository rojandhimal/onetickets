# Progress: backend

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-23 (S2-2 orders API & database migration)

- **Done:** Implemented backend orders and free checkout infrastructure supporting **S2-2**:
  - Created database migration `apps/api/migrations/0009_orders.sql`:
    - Tables `orders.orders` and `orders.tickets` with enforced foreign keys to `identity.organisations`, `catalogue.events`, and `catalogue.ticket_types`.
    - Unique index `idx_orders_idempotency` enforcing `INV-5` (idempotent re-submission returns original order without duplicating tickets or stock).
    - Full forced RLS (`orders_tenant`, `orders_public_insert`, `orders_public_select`, `orders_worker`).
  - Added shared API contracts in `packages/shared/src/api/orders.ts` (`createFreeOrderBody`, `OrderDto`, `OrderTicketDto`, `PublicOrderDto`) and unit tests in `orders.test.ts`.
  - Implemented `OrdersModule` in `apps/api/src/modules/orders/`:
    - `OrdersRepository`: creates orders, converts holds to sold tickets, handles idempotency retrieval, and finds public orders by reference.
    - `OrdersService`: orchestrates single-unit-of-work free order completion, hold conversion, and order reference generation (`OT-XXXXXXXX`).
    - `OrdersController`: public endpoints `POST /public/orders/free` and `GET /public/orders/:orderRef`.
  - Added comprehensive integration tests in `apps/api/test/orders.int.test.ts` (idempotency under concurrency with 6 parallel racing submissions, hold conversion, public order lookup, validation errors).
  - Documented in `docs/backend/orders.md` and `docs/api/orders.md`.
- **Next:** QR ticket generation and signing (S2-3).
- **Blocked:** None.

## 2026-10-21

- **Done:** Implemented **S2-1 Free ticket holds and inventory** on `backend/s2-1-ticket-holds`:
  - Created migration `apps/api/migrations/0008_ticket_holds.sql` adding `inventory.holds` with forced RLS (`holds_tenant`, `holds_public`, `holds_worker`) and added `ticket_inventory_public_hold` to allow atomic updates on published events during checkout.
  - Implemented `InventoryModule` in `apps/api/src/modules/inventory/`: `HoldsRepository`, `HoldsService`, and `HoldsController` under `/public/holds`.
  - Atomic hold reservation with a single conditional update on `inventory.ticket_inventory` (`INV-1`, `INV-2`, ADR 0007).
  - ARCH-2 / INV-15: Distinguishes "sold out" (`sold >= capacity`, `409 sold_out`) from "all taken right now" (`sold + held >= capacity && sold < capacity`, `409 all_taken`). Added `soldOut: boolean` to `PublicTicketTypeDto` and `PublicEventDto`.
  - Enforced per-order limits (`INV-4`), hold renewal up to 20 minutes maximum cap, hold release, and atomic quantity adjustment.
  - Expired holds sweeper in one transaction per hold (`INV-3`), returning stock exactly once under concurrency.
  - Added comprehensive integration tests in `apps/api/test/inventory.int.test.ts` (15 tests covering database CHECK constraint violations, 50 parallel buyers racing for the last 10 tickets, sweeper concurrency with 100 holds, hold lifecycle, and quantity adjustments).
  - Documented module in `docs/backend/inventory.md` and `docs/api/inventory.md`, and updated `docs/backend/catalogue.md` and `docs/api/events.md`.
- **Next:** QA and Security reviews for S2-1 PR, then S2-2 (One-screen free checkout frontend) / S2-3 (QR ticket signing).
- **Blocked:** nothing.

## 2026-10-18

- **Done:** Built the remaining BE-1 catalogue hardening items on `backend/be-1-catalogue-hardening`:
  - Patching a `published` event now refuses moving `startsAt` into the past (`startsAt <= now`) with `422 starts_in_past` (`field: 'startsAt'`), while still allowing edits to other fields on an already-started live event when `startsAt` is unchanged or omitted.
  - Patching an event with `{ kind: 'place', placeId, ... }` now resolves the venue from `PlacesProvider.get(placeId)` on the server, stores the provider's canonical `name`, `address`, `suburb`, `city`, `lat`, and `lng` (cleaned through `toPlainLine`), and refuses unknown `placeId`s with `422 unknown_place` (`field: 'venue'`).
  - Public repository queries (`EventsRepository.findPublished` and `EventsRepository.browse`) now project only public columns in SQL (`PUBLIC_EVENT_COLUMNS` and explicit browse card columns), computing `catalogue.organiser_name(organisation_id) as organiser_name`, `(contact_email is not null) as has_contact_email`, and stripping an online venue's `url` in SQL so `organisation_id`, `contact_email`, and online `url` never enter the API process on public reads.
  - Added integration tests for all three items (verified by mutation checks) and updated `docs/backend/catalogue.md` and `docs/api/events.md`.
- **Next:** QA and Security reviews on the BE-1 hardening PR, then Sprint 2 free ticket checkout (`S2-1`).
- **Blocked:** nothing. The S3 banner adapter (`S1-3`) waits on DevOps' bucket (`DEV-3`).

## 2026-10-16 (evening)

- **Done:** QA and Security passed [#34](https://github.com/rojandhimal/onetickets/pull/34) at c5acdb3, and all five checks are green there. I marked it ready for review, and PM has queued it for tegs.
- **Next:** When #34 merges, restart claude/backend-mo4kfg from main and do DEV-4 (Docker image builds in PR checks). After that, the publish contact-email fallback if Security and ProductDesign put it in the api. Then live events moved into the past, server-side place resolution, and the narrower public projection.
- **Blocked:** nothing.

## 2026-10-16 (later)

- **Done:** tegs merged #25, which includes BE-4's fan-out to every web task. I opened draft [#34](https://github.com/rojandhimal/onetickets/pull/34) for QA's #23 finding:
  - Organisation names are now stored as one line of plain text, and a markup-only name gets 422.
  - The sanitiser moved to apps/api/src/text.
  - Migration 0007 cleans the names already stored, through a backfill policy. A test checks the SQL copy against the api on 2,015 inputs, and mutation checks pass.
- **Next:** QA and Security on #34. Then DEV-4 (Docker builds in PR checks), live events moved into the past, server-side place resolution, and the narrower public projection.
- **Blocked:** nothing.

## 2026-10-16

- **Done:** tegs merged #22. I restarted claude/backend-mo4kfg from main and opened draft [#25](https://github.com/rojandhimal/onetickets/pull/25) for BE-1 Cache-Control and revalidation, with all local checks passing. The design is agreed with FrontendDev (`{ slugs }` payload; the web holds the tags) and DevOps (WEB_INTERNAL_URL and REVALIDATE_SECRET come in their next infra PR).
- **Next:** QA's review and CI on #25 (Security passed it). Then QA's #23 finding: organisation names skip toPlainLine. That means moving the sanitiser somewhere both identity and catalogue can import, plus a migration to clean existing names. After that, the next BE-1 item: server-side place resolution, live events that move into the past, or a narrower public projection.
- **Blocked:** nothing. #25 stays off in AWS until DevOps' secret and FrontendDev's revalidate route land.

## 2026-10-15 (late night)

- **Done:**
  - #22 marked ready (CI green on 478a91b, QA passed). PM queued it for tegs; BE-2 and BE-3 are closed by it.
  - BE-1 Cache-Control and revalidation built and committed locally (471bd7a, local branch be1-cache), not pushed while #22 is open.
    - A found event and browse send `public, max-age=0, s-maxage=60, stale-while-revalidate=300`. Every other api response, 404s and errors included, sends no-store.
    - Publishing or editing a live event POSTs `{ slugs }` to WEB_URL/internal/revalidate with REVALIDATE_SECRET. It's off when unset.
    - Tests and mutation checks pass. Docs are updated.
  - Sent the design to FrontendDev (payload, and whether the page is cached at the edge or with ISR) and to DevOps (the new REVALIDATE_SECRET for the api and web).
- **Next:** When #22 merges, restart claude/backend-mo4kfg from main, apply the commit, open the PR, and ask QA and Security to review.
- **Blocked:** nothing.

## 2026-10-15 (night)

- **Done:** #22 now follows PM's "from" rule (cheapest type on sale, else cheapest of all). QA asked that the browse free/paid filter use the same rule, so in 3be9651 I moved it into one SQL function, catalogue.from_price_cents (migration 0006). Cards, the filter and the event page all read it. I added QA's three cases and a SQL/TS on-sale parity test, and mutation-checked them. FrontendDev agreed the contract.
- **Next:** QA passed #22 at 3be9651. QA then asked (not blocking) for a stronger SQL/TS on-sale parity test, which I pushed as 478a91b. It's test-only and kills all four surviving mutants. PM had carded that test as BE-3 for a follow-up PR, but our messages crossed, so it's already in #22. Mark #22 ready once CI is green on 478a91b. After that, the next BE-1 item.
- **Blocked:** nothing. The S3 adapter is waiting on DevOps' bucket.

## 2026-10-15 (late)

- **Done:** tegs merged #16 (S1 api) at 13:20 UTC. I restarted my branch from main and opened draft [#22](https://github.com/rojandhimal/onetickets/pull/22) for BE-1. It adds one pricing function (pricing.ts) used by both the browse cards and the event page, and a priceCents max of A$10,000 (zod plus a DB CHECK, migration 0005). Local Postgres now matches CI: migrations run as onetickets_owner, a non-superuser.
- **Next:** FrontendDev's OK on the contract, QA review of #22, and CI. Then the next BE-1 item. The S3 adapter is waiting on DevOps' bucket.
- **Blocked:** nothing.

## 2026-10-15 (evening)

- **Done:** I fixed QA's four #16 blockers in 4cc4e2b:
  - INV-1 inventory table with the sold+held<=capacity CHECK and sync triggers.
  - A fixed-point SEC-3 sanitiser.
  - A test for the paid-ticket check on edits.
  - Role, browse and pinned-clock DST tests, verified by mutation.
  - docs/backend/catalogue.md.
    Earlier today: Security passed #16 at 8abb201 (RDS migration fix and Clear-Site-Data on sign-out).
- **Next:** QA and Security re-checks, and #16 CI green. Then the S3 banner adapter.
- **Blocked:** nothing.

## 2026-10-15 (later)

- **Done:** I fixed Security's #16 review (82acc18 and 05c061d):
  - Public names and venue text are now cleaned to one line. This was the blocker.
  - Banner uploads are checked by file signature before decoding.
  - organiser_name() is owned by a NOLOGIN ot_public_reader role.
  - The upload rate limit and concurrency are left for SEC-15.
  - Docs and ADR 0017 are updated. All checks pass locally, with 88 integration tests.
- **Next:** Drive #16 CI green, through QA and the Security re-check. Then the S3 banner adapter, once DevOps has the bucket.
- **Blocked:** nothing.

## 2026-10-15

- **Done:** #14 (S0-5 api) merged on 10 Oct, which closes Sprint 0. I restarted my branch from main and opened the S1 api as draft [#16](https://github.com/rojandhimal/onetickets/pull/16). It includes the BannerDto.ogUrl preview image FrontendDev asked for, and the integration tests pass locally (87/87). QA and Security have been asked to review it.
- **Next:** Get #16 green and through QA and Security. Then the S3 banner adapter, once DevOps has the bucket.
- **Blocked:** nothing.

## 2026-10-10 (later)

- **Done:** Fixed the #14 review. Error logs now keep their type and stack with PII redacted, an int test covers a throwing route, and the gitleaks false positive is cleared. The S1 api is built locally and all its checks pass (84 integration tests): events with RLS, template drafts with versioned autosave, free ticket types, publish, banners, venue lookup, the public page, browse, SEC-3 plain text, and ADR 0017. The contract is agreed with FrontendDev; the final version is at contracts/events-s1.ts.
- **Next:** Open the S1 api PR as soon as #14 merges. Then the S3 banner adapter once DevOps has the bucket.
- **Blocked:** The S1 PR waits on #14 merging, because I can only push to one branch. #14 waits on CI, QA and Security re-checks, and tegs's review.

## 2026-10-10

- **Done:** S0-5 api observability is up as draft [#14](https://github.com/rojandhimal/onetickets/pull/14). It adds JSON logs with requestId, userId and organisationId, PII masked using the shared redact(), Sentry tagged with environment and release, and traces from web to api to Postgres. Tests prove a PII sample never leaks, and docs are in docs/backend/observability.md. QA, Security and DevOps have been briefed (the Dockerfile CMD needs `--import`).
- **Next:** Agree the S1 events and ticket-type zod contract with FrontendDev in packages/shared. Then build the S1 api: events with RLS, free ticket types, banner storage, public read and browse, and SEC-3 sanitising.
- **Blocked:** nothing. #14 waits on CI, QA and tegs's review.

## 2026-10-09 (evening)

- **Done:** [#10](https://github.com/rojandhimal/onetickets/pull/10) (S0-3 sign-in) passed QA and Security after fixes: MFA enrolment email, revoking the old session on re-sign-in, unspoofable per-IP limits (TRUST_PROXY_HOPS=0 locally), a rolling hourly cap on sign-in emails, and a recovery-code RLS test. CI is green and the PR is marked ready for review.
- **Next:** Merge main into #10 after #7, #8 and #11 land. Then S0-5 api observability on the shared scrubbers from #9.
- **Blocked:** nothing. #10 waits on tegs's review.

## 2026-10-09 (later)

- **Done:** S0-4 merged ([#6](https://github.com/rojandhimal/onetickets/pull/6)). S0-3 sign-in is up as draft [#10](https://github.com/rojandhimal/onetickets/pull/10), with docs (API, env vars, ADR 0002) and the S0-4 docs. It covers magic link, Google behind config, sessions, TOTP MFA, and SES/SMTP/console mail.
- **Next:** Get #10 green, then S0-5 api observability.
- **Blocked:** nothing. #10 waits on CI and tegs's review.

## 2026-10-09

- **Done:** S0-1 monorepo and CI merged ([#1](https://github.com/rojandhimal/onetickets/pull/1)). S0-4 orgs, roles, RLS and step-up MFA rules are up as [#6](https://github.com/rojandhimal/onetickets/pull/6), including QA's tests for audit isolation and the forced-RLS guard. S0-3 auth (magic link, sessions, TOTP MFA, Google behind config, SES/SMTP/console mail) is built locally with 57 tests green. The api Dockerfile and compose Postgres binding went to DevOps (#4).
- **Next:** Open the S0-3 auth PR with docs (API endpoints, env vars, an ADR on sessions and magic links) once #6 merges. Then the CI hardening PR (SHA pins, api-image job) after #4 lands. Then S0-5 api observability.
- **Blocked:** #6 waits on tegs's review. The S0-3 PR can't open until #6 merges, because only one branch is allowed (the decision card on own branches is unanswered).
