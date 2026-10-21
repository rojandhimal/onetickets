# Inventory

Module: `apps/api/src/modules/inventory`. Contracts: `packages/shared/src/api/inventory.ts`.
Decision records: [ADR 0007](../adr/0007-postgres-is-the-authority-for-stock-and-money.md).

The inventory module tracks ticket capacity, reserves atomic short-lived holds during checkout, and
ensures that stock invariants are never violated under heavy concurrency. PostgreSQL is the single
source of truth for stock and capacity.

## Responsibilities

- **Owns:** Schema `inventory`, table `inventory.ticket_inventory` (capacity, sold, held counts) and
  `inventory.holds` (temporary buyer holds with cryptographically hashed tokens, expiry, and release/conversion status).
- **Enforces invariants:**
  - `INV-1`: `sold >= 0 and held >= 0 and sold + held <= capacity` via database CHECK constraint.
  - `INV-2`: Holds reserved with a single conditional `UPDATE ... WHERE sold + held + qty <= capacity`. No rows returned indicates insufficient capacity or sold out.
  - `INV-3`: Expired holds return stock exactly once via sweeper running one transaction per hold.
  - `INV-4`: Per-order limit (`max_per_order`) enforced before hold reservation.
  - `ARCH-2` / `INV-15`: Distinguishes "sold out" (`sold >= capacity`) from "all taken right now" (`sold + held >= capacity` and `sold < capacity`).
- **Does not do:** Order creation or ticket issuance (owned by `CheckoutModule` and `TicketingModule` in Sprint 2).

## Public surface

Exported from `apps/api/src/modules/inventory/index.ts`:

| Export                        | What it does                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `InventoryModule`             | NestJS module registering inventory repositories, services, and public controller                 |
| `HoldsService`                | Service providing `reserve()`, `renew()`, `release()`, `get()`, `convert()`, and `sweepExpired()` |
| `HOLD_DURATION_SECONDS`       | Initial hold duration (600s / 10 minutes)                                                         |
| `HOLD_RENEW_INTERVAL_SECONDS` | Renewal interval while page is active (300s / 5 minutes)                                          |
| `MAX_HOLD_DURATION_SECONDS`   | Maximum hold duration cap (1200s / 20 minutes)                                                    |

## HTTP endpoints

All endpoints live under `/public/holds` and require no session:

| Method and path                  | Who may call it | What it does                                                                 |
| -------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `POST /public/holds`             | Public buyer    | Reserves a hold on a ticket type, optionally replacing a previous hold       |
| `GET /public/holds/:id`          | Public buyer    | Retrieves hold status (`active`, `expired`, `released`, `converted`)         |
| `POST /public/holds/:id/renew`   | Public buyer    | Renews hold expiry by 10m while user is active on checkout (up to 20m total) |
| `POST /public/holds/:id/release` | Public buyer    | Releases hold and returns held quantity to available stock                   |

Request and response contracts live in `packages/shared/src/api/inventory.ts`.

## Data and Row-Level Security

Schema `inventory`:

- **`inventory.ticket_inventory`**:
  - Primary key `ticket_type_id references catalogue.ticket_types (id) on delete cascade`.
  - Columns: `organisation_id`, `event_id`, `capacity`, `sold`, `held`, `updated_at`.
  - Invariant constraint: `ticket_inventory_within_capacity` (`sold >= 0 and held >= 0 and sold + held <= capacity`).
  - RLS policies:
    - `ticket_inventory_tenant` for `ot_app` (organiser tenant access).
    - `ticket_inventory_public` for `select to ot_app` on published events.
    - `ticket_inventory_public_hold` for `update to ot_app` on published events (enables conditional reservation).
    - `ticket_inventory_worker` for `ot_worker` (background sweeper).

- **`inventory.holds`**:
  - Primary key `id uuid default gen_random_uuid()`.
  - Columns: `ticket_type_id`, `organisation_id`, `event_id`, `quantity`, `token_hash bytea unique`, `created_at`, `expires_at`, `released_at`, `converted_at`.
  - Constraint: `hold_state_exclusive` (`not (released_at is not null and converted_at is not null)`).
  - RLS policies:
    - `holds_tenant` for `ot_app` (scoped to `identity.current_organisation_id()`).
    - `holds_public` for `ot_app` (allows create, inspect, and update for published events).
    - `holds_worker` for `ot_worker` (background sweeper).

## Token Security

A 256-bit URL-safe token is generated using `crypto.randomBytes(32).toString('base64url')` and returned to the client.
Only `crypto.createHash('sha256').update(token).digest()` is stored in `inventory.holds.token_hash`.
The raw token is never stored or logged.

## How to run and test it locally

Integration tests test against real PostgreSQL:

```sh
pnpm --filter @onetickets/api test:integration test/inventory.int.test.ts
```

Concurrency race tests simulate:

- 50 parallel buyers racing for the last 10 tickets: exactly 10 succeed, 40 fail, and inventory held equals 10.
- 2 concurrent sweepers sweeping 100 expired holds simultaneously: exactly 100 holds are swept, and held count drops to 0 without underflow.
