# Inventory and holds API

Module: `apps/api/src/modules/inventory`. Contracts: `packages/shared/src/api/inventory.ts`.
Decision record: [ADR 0007](../adr/0007-postgres-is-the-authority-for-stock-and-money.md).

Errors use `ApiErrorBody` (`{ statusCode, code, message, field? }`), plus extra fields as noted below.
Switch on `code`, not on the message.

## Public routes

No session needed. State-changing requests (`POST`) require the web app's origin (`Origin: http://localhost:3000` or production URL) and `Content-Type: application/json`.

| Method and path                  | Body                                                   | Success                 |
| -------------------------------- | ------------------------------------------------------ | ----------------------- |
| `POST /public/holds`             | `ReserveHoldBody`                                      | 201 `HoldDto`           |
| `GET /public/holds/:id`          | none (optional query `token` or header `x-hold-token`) | 200 `HoldPublicDto`     |
| `POST /public/holds/:id/renew`   | `HoldTokenBody` (`{ token }`)                          | 200 `{ id, expiresAt }` |
| `POST /public/holds/:id/release` | `HoldTokenBody` (`{ token }`)                          | 200 `{ ok: true }`      |

### Reserve a hold (`POST /public/holds`)

Reserves a temporary hold on a ticket type during checkout. Holds decrement available stock
atomically without locking rows across network calls (INV-1, INV-2).

- **Body:**
  - `ticketTypeId` (UUID): The ticket type to hold.
  - `quantity` (integer): Between 1 and 100, and must not exceed the ticket type's `max_per_order` limit (INV-4).
  - `previousHoldId` (UUID, optional): If adjusting an existing hold (e.g. changing quantity in the stepper), the previous hold ID.
  - `previousToken` (string, optional): The raw token for the previous hold. When provided, the old hold is released and the new hold reserved atomically in the same transaction. If reservation of the new quantity fails (insufficient spots), the transaction rolls back, preserving the previous hold.

- **Success:** `201 Created` returning `HoldDto`:
  - `id`: Unique hold UUID.
  - `ticketTypeId`: Ticket type UUID.
  - `eventId`: Event UUID.
  - `quantity`: Number of tickets held.
  - `token`: 256-bit URL-safe secret token (`crypto.randomBytes(32).toString('base64url')`).
  - `expiresAt`: ISO 8601 timestamp (10 minutes from creation).
  - `createdAt`: ISO 8601 timestamp.

- **Errors:**
  - `404 ticket_type_not_found`: Ticket type does not exist.
  - `404 event_not_found`: Event does not exist or is not published.
  - `422 not_on_sale`: Sales window is not open for this ticket type.
  - `422 invalid_quantity`: Quantity is less than 1 or exceeds `max_per_order` (`field: 'quantity'`).
  - `409 all_taken`: All tickets are currently held by other buyers (`sold + held >= capacity && sold < capacity`). Message: _"All taken right now. Check back in a few minutes."_ (ARCH-2 / INV-15).
  - `409 sold_out`: All tickets are sold (`sold >= capacity`). Message: _"Those tickets have just gone. Nothing was booked."_ (ARCH-2 / INV-15).
  - `409 insufficient_spots`: Fewer spots remain than requested. Body includes `spotsLeft: number` and `field: 'quantity'`.

### Get hold status (`GET /public/holds/:id`)

Retrieves the current status of a hold.

- **Query / Header:** `token` (query parameter or `x-hold-token` header).
- **Success:** `200 OK` returning `HoldPublicDto`:
  - `id`, `ticketTypeId`, `eventId`, `quantity`, `expiresAt`, `createdAt`.
  - `status`: `'active' | 'expired' | 'released' | 'converted'`.
- **Errors:**
  - `404 hold_not_found`: Hold does not exist or token does not match.

### Renew a hold (`POST /public/holds/:id/renew`)

Renews an active hold while the buyer has activity on the checkout page (up to 20 minutes maximum total).

- **Body:** `{ token: string }`.
- **Success:** `200 OK` returning `{ id, expiresAt }` (extended by 10 minutes up to the 20-minute cap).
- **Errors:**
  - `404 hold_not_found`: Hold does not exist or token is invalid.
  - `410 hold_expired`: Hold has already expired.
  - `409 max_hold_duration_reached`: Hold has reached the 20-minute maximum duration limit.

### Release a hold (`POST /public/holds/:id/release`)

Releases a hold and immediately returns held quantity to available inventory.

- **Body:** `{ token: string }`.
- **Success:** `200 OK` returning `{ ok: true }`. Idempotent if called multiple times.
