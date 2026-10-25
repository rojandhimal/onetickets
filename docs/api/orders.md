# Orders and tickets API

Module: `apps/api/src/modules/checkout` (orders) and `apps/api/src/modules/ticketing` (tickets).
Contracts: `packages/shared/src/api/orders.ts` and `packages/shared/src/api/tickets.ts`. Decision
records: [ADR 0007](../adr/0007-postgres-is-the-authority-for-stock-and-money.md) and
[ADR 0011](../adr/0011-signed-offline-qr-tickets.md). How it works inside:
[backend/ticketing.md](../backend/ticketing.md).

Errors use `ApiErrorBody` (`{ statusCode, code, message, field? }`). Switch on `code`. Every
response is `Cache-Control: no-store`: QR tokens and ticket keys are bearer credentials.

| Method and path                       | Auth                          | Body              | Success               |
| ------------------------------------- | ----------------------------- | ----------------- | --------------------- |
| `POST /public/orders`                 | none (web app origin)         | `CreateOrderBody` | 201 `CreatedOrderDto` |
| `GET /public/orders/:orderId/tickets` | `Authorization: Bearer <key>` | none              | 200 `OrderTicketsDto` |

## Make a free order (`POST /public/orders`)

Turns a checkout's holds into one order and its tickets, in one transaction (S2-2).

- **Body:** `idempotencyKey` (UUID, one per checkout session; every submit sends the same one),
  `holds` (1 to 20 `{ id, token }`, from `POST /public/holds`, all for one event), `name` (1 to 100
  characters), `email`, `marketingOptIn`.
- **Success:** `201` with `CreatedOrderDto`: `orderId`, `email`, `event` (slug, name, times, time
  zone, venue, organiser), `tickets` and `ticketKey`. Each ticket has `id`, `ref` (8 Crockford
  base32 characters for the stub), `holderName`, `ticketTypeId`, `ticketTypeName`, `qr` (the token
  to draw, or null while unsigned or revoked), `status` (`valid` or `revoked`) and `issuedAt`.
- **Retries (INV-5):** the same `idempotencyKey` with the same holds returns the same order, with a
  fresh `ticketKey`. Earlier keys keep working. Parallel submits make one order.
- **Then:** send the buyer to `confirmationPath(orderId, ticketKey)` from `@onetickets/shared`
  (`/tickets/:orderId#key=…`). The key rides in the fragment, never a query string.
- **Errors:**
  - `410 hold_expired`: a hold lapsed, was released or was already used. Nothing was kept: re-hold
    and retry with the same idempotency key.
  - `409 idempotency_conflict`: that idempotency key was used with other holds.
  - `422 holds_mixed_events`: holds from more than one event.
  - `422` validation errors with `field`.
  - `403 bad_origin`: not from the web app.

## Read an order's tickets (`GET /public/orders/:orderId/tickets`)

For the confirmation screen and the link in the ticket email.

- **Auth:** the order's ticket key as `Authorization: Bearer <ticketKey>`. Never in the URL.
- **Success:** `200` with `OrderTicketsDto` (as above, without `ticketKey`).
- **Errors:** `404 order_not_found` for a wrong id, a wrong, missing or expired key, or a key to
  another order, all alike. Keys work until the event ends plus 7 days.
