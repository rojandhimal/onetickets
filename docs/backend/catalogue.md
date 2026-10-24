# Catalogue

Events and their ticket types: organisers create, autosave and publish them (S1-1 to S1-3), and
anyone can read published events and browse them by city and time (S1-5). Owners and admins use
the organiser routes; the public event page and browse use the public ones.

## Responsibilities

- Owns the `catalogue` schema (events, ticket types) and the `inventory` schema (one inventory
  row per ticket type).
- Stores descriptions and names as plain text (SEC-3), resolves `place` venues on the server from
  `PlacesProvider.get(placeId)` (`422 unknown_place` if missing), refuses moving a live event's
  `startsAt` into the past (`422 starts_in_past`), and stores banners as re-encoded images.
- Does not take bookings, hold or sell tickets: that is Sprint 2's orders module, which will
  change `sold` and `held` through the inventory row with one conditional update (ADR 0007).

## Public surface

| Export                   | What it does                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `CatalogueModule`        | The Nest module with the routes below                          |
| `EventsService`          | Public methods for events, browse, and ticket type summary     |
| `TicketTypeSummary`      | Summary interface exported for inventory holds validation      |
| `BannerStorage`          | Interface for where banners live (local disk or S3)            |
| `LocalDiskBannerStorage` | The development implementation, under `BANNER_DIR`             |
| `S3BannerStorage`        | AWS: the uploads bucket under `banners/` (`BANNER_STORAGE=s3`) |

## HTTP endpoints

See [docs/api/events.md](../api/events.md). Request and response schemas:
`packages/shared/src/api/events.ts`.

## Data

Schema `catalogue`:

- `events`: one row per event, draft or published. `version` is bumped on every change (autosave
  conflict check). A published event must have a slug, name, times and venue (CHECK). `city` is
  copied from a place venue for browse; online events have none and show in every city.
- `ticket_types`: belongs to an event, with `organisation_id` repeated so RLS needs no join.
  Capacity 1 to 100,000, max per order at most the capacity, price in whole cents up to
  1,000,000 (A$10,000, `ticket_types_price_limit`).

Schema `inventory`:

- `ticket_inventory`: one row per ticket type with `capacity`, `sold` and `held`.

Invariants the database enforces:

- **INV-1:** `sold >= 0 and held >= 0 and sold + held <= capacity`
  (`ticket_inventory_within_capacity`). Triggers on `ticket_types` create the inventory row with
  the ticket type, copy capacity changes to it in the same transaction (so capacity can't drop
  below what is sold or held), and refuse deleting a type with tickets sold or held. Neither app
  role may delete an inventory row. Tested in `test/catalogue.int.test.ts` ("never lets
  oversell"), which sends raw updates as `ot_app` that must fail.
- Row-level security is forced on every table. `ot_app` sees its own organisation's rows, plus
  published events (`events_public`), their ticket types and their inventory for the public routes.
  Because Postgres RLS is row-level, the public repository queries (`EventsRepository.findPublished`
  and `EventsRepository.browse`) also narrow the column projection in SQL (`PUBLIC_EVENT_COLUMNS`
  and the browse card projection): SQL computes `catalogue.organiser_name(organisation_id) as organiser_name`,
  `(contact_email is not null) as has_contact_email`, and strips an online venue's `url` before the
  row leaves Postgres, so `organisation_id`, `contact_email` and the online `url` are never read
  into the API process on public routes. `catalogue.organiser_name()` returns an organisation's
  name only when it has a published event; it runs as `ot_public_reader`, a role nobody logs in as.
  Tested in `test/rls.int.test.ts` and `test/catalogue.int.test.ts`.

## Configuration

| Variable               | Required    | Local value   | What it does                          |
| ---------------------- | ----------- | ------------- | ------------------------------------- |
| `FEATURE_PAID_TICKETS` | no (off)    | unset         | `on` allows ticket prices above 0     |
| `BANNER_DIR`           | no          | `var/banners` | Where local-disk banners are stored   |
| `PLACES_PROVIDER`      | no (`fake`) | `fake`        | Venue lookup provider                 |
| `REVALIDATE_SECRET`    | no (off)    | unset         | Tells the web app a live page changed |

See [environment.md](environment.md) for the full list.

## How to run and test it locally

`pnpm --filter @onetickets/api test` runs the unit tests (sanitiser, sales windows, publish
checklist, banners). `pnpm --filter @onetickets/api test:integration` needs Postgres and
`MIGRATION_DATABASE_URL`; `test/catalogue.int.test.ts`, `test/browse-window.int.test.ts` (time
windows from design's handoff with a pinned clock, across both daylight-saving changes) and `test/rls.int.test.ts` cover
this module.

## Decisions

- [ADR 0007](../adr/0007-postgres-is-the-authority-for-stock-and-money.md): Postgres is the
  authority for stock; holds by conditional update.
- [ADR 0017](../adr/0017-public-event-reads-and-plain-text-descriptions.md): public reads and
  plain-text descriptions.

## Known limits and follow-ups

- SEC-15: per-user rate limit on banner uploads and one image job at a time.
- Prices: the "from" price rule (cheapest type on sale, else cheapest of all) is one SQL function,
  `catalogue.from_price_cents` (migration 0006), used by browse, its free/paid filter and the event
  page. Its on-sale test, `catalogue.ticket_on_sale`, repeats `sales-window.ts`, which still sets each
  type's `onSale` flag; an integration test keeps the two in step. Fees go on top in `pricing.ts`
  (Sprint 4), and only ever raise a price above 0, so free stays free.
- Revalidation is fire-and-forget: a signal lost while the web app is down is not retried, so the
  page is stale until its 60 s cache time ends. An edge purge (Cloudflare) is not wired up yet.
