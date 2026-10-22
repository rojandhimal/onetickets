# Orders

Module: `apps/api/src/modules/orders`. Contracts: `packages/shared/src/api/orders.ts`.
Decision records: [ADR 0007](../adr/0007-postgres-is-the-authority-for-stock-and-money.md).

The orders module manages attendee orders and issued tickets. During free checkout (S2-2),
it converts held stock into sold stock and creates attendee ticket records atomically.

## Responsibilities

- **Owns:** Schema `orders`, table `orders.orders` and `orders.tickets`.
- **Enforces invariants:**
  - `INV-5`: Same idempotency key returns the same order and creates no second hold or duplicate tickets. Enforced by unique index on `orders.orders(idempotency_key)`.
  - Atomically converts holds to sold stock via `HoldsService.convert()` inside the order transaction.
- **Does not do:** Payment processing (Sprint 4 Stripe Connect) or QR cryptographic signing (Sprint 2 S2-3).

## Public surface

Exported from `apps/api/src/modules/orders/index.ts`:

| Export             | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `OrdersModule`     | NestJS module registering orders controller, service, repo  |
| `OrdersService`    | Service providing `createFreeOrder()` and `getByOrderRef()` |
| `OrdersRepository` | SQL repository for orders and tickets tables                |
| `newOrderRef`      | Generates human-friendly Crockford Base32 order refs        |
| `newTicketRef`     | Generates attendee ticket refs                              |

## HTTP endpoints

All endpoints live under `/public/orders`:

| Method and path           | Who may call it | What it does                                     |
| ------------------------- | --------------- | ------------------------------------------------ |
| `POST /public/orders`     | Public buyer    | Places a free ticket order using an active hold  |
| `GET /public/orders/:ref` | Public buyer    | Retrieves public order and ticket summary by ref |

Request and response contracts live in `packages/shared/src/api/orders.ts`.

## Data and Row-Level Security

Schema `orders`:

- **`orders.orders`**:
  - Primary key `id uuid default gen_random_uuid()`.
  - Columns: `order_ref text unique`, `organisation_id uuid`, `event_id uuid`, `hold_id uuid`, `idempotency_key uuid`, `attendee_name text`, `attendee_email text`, `opt_in_organiser boolean`, `total_price_cents integer`, `status text`, `created_at timestamptz`.
  - Unique index `orders_idempotency_key_idx on orders.orders (idempotency_key)`.
  - Forced RLS: `orders_tenant` (scoped to `identity.current_organisation_id()`), `orders_public_insert` and `orders_public_select` (for published events), `orders_worker`.

- **`orders.tickets`**:
  - Primary key `id uuid default gen_random_uuid()`.
  - Columns: `order_id uuid references orders.orders`, `ticket_ref text unique`, `ticket_type_id uuid`, `organisation_id uuid`, `event_id uuid`, `attendee_name text`, `status text`, `created_at timestamptz`.
  - Forced RLS: `tickets_tenant`, `tickets_public_insert`, `tickets_public_select`, `tickets_worker`.

## How to run and test it locally

Integration tests test against real PostgreSQL:

```sh
pnpm --filter @onetickets/api test:integration test/orders.int.test.ts
```
