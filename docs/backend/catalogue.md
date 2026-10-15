# Catalogue

Events and their ticket types: organisers create, autosave and publish them (S1-1 to S1-3), and
anyone can read published events and browse them by city and time (S1-5). Owners and admins use
the organiser routes; the public event page and browse use the public ones.

## Responsibilities

- Owns the `catalogue` schema (events, ticket types) and the `inventory` schema (one inventory
  row per ticket type).
- Stores descriptions and names as plain text (SEC-3) and banners as re-encoded images.
- Does not take bookings, hold or sell tickets: that is Sprint 2's orders module, which will
  change `sold` and `held` through the inventory row with one conditional update (ADR 0007).

## Public surface

| Export                   | What it does                                                 |
| ------------------------ | ------------------------------------------------------------ |
| `CatalogueModule`        | The Nest module with the routes below                        |
| `BannerStorage`          | Interface for where banners live (local disk now, S3 in AWS) |
| `LocalDiskBannerStorage` | The development implementation, under `BANNER_DIR`           |

## HTTP endpoints

See [docs/api/events.md](../api/events.md). Request and response schemas:
`packages/shared/src/api/events.ts`.

## Data

Schema `catalogue`:

- `events`: one row per event, draft or published. `version` is bumped on every change (autosave
  conflict check). A published event must have a slug, name, times and venue (CHECK). `city` is
  copied from a place venue for browse; online events have none and show in every city.
- `ticket_types`: belongs to an event, with `organisation_id` repeated so RLS needs no join.
  Capacity 1 to 100,000, max per order at most the capacity, price in whole cents.

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
  published events, their ticket types and their inventory for the public routes.
  `catalogue.organiser_name()` returns an organisation's name only when it has a published event;
  it runs as `ot_public_reader`, a role nobody logs in as. Tested in `test/rls.int.test.ts`.

## Configuration

| Variable               | Required    | Local value   | What it does                        |
| ---------------------- | ----------- | ------------- | ----------------------------------- |
| `FEATURE_PAID_TICKETS` | no (off)    | unset         | `on` allows ticket prices above 0   |
| `BANNER_DIR`           | no          | `var/banners` | Where local-disk banners are stored |
| `PLACES_PROVIDER`      | no (`fake`) | `fake`        | Venue lookup provider               |

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
- Browse prices use the cheapest type; the event page uses the cheapest on sale. They agree while
  every ticket is free; one pricing function is needed before paid tickets (Sprint 4).
- Public responses don't send `Cache-Control` yet, and nothing revalidates a cache on publish.
