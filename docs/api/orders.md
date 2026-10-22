# Orders API

Module: `apps/api/src/modules/orders`. Contracts: `packages/shared/src/api/orders.ts`.
Decision record: [ADR 0007](../adr/0007-postgres-is-the-authority-for-stock-and-money.md).

## Public routes

No session needed. State-changing requests (`POST`) require the web app's origin and `Content-Type: application/json`.

| Method and path           | Body                  | Success              |
| ------------------------- | --------------------- | -------------------- |
| `POST /public/orders`     | `CreateFreeOrderBody` | 201 `OrderDto`       |
| `GET /public/orders/:ref` | none                  | 200 `PublicOrderDto` |

### Create a free order (`POST /public/orders`)

Converts an active hold into a confirmed free ticket order (INV-5, S2-2).

- **Body:**
  - `eventId` (UUID): The event being booked.
  - `holdId` (UUID): Active hold ID.
  - `holdToken` (string): Secret token returned when hold was reserved.
  - `idempotencyKey` (UUID): Client-generated UUID for the checkout session.
  - `attendeeName` (string): Name for the tickets (1 to 100 characters).
  - `attendeeEmail` (string): Email address where tickets will be delivered.
  - `optInOrganiser` (boolean, optional): Whether attendee opted in to organiser news (defaults to false).

- **Success:** `201 Created` returning `OrderDto`:
  - `id`: Order UUID.
  - `orderRef`: Human-friendly reference code (`OT-XXXXXXXX`).
  - `eventId`: Event UUID.
  - `eventTitle`: Title of the event.
  - `attendeeName`: Name on the order.
  - `attendeeEmail`: Email on the order.
  - `ticketCount`: Number of tickets issued.
  - `totalPriceCents`: `0`.
  - `status`: `'confirmed'`.
  - `tickets`: Array of `OrderTicketDto` (`id`, `ticketRef`, `ticketTypeId`, `ticketTypeName`, `attendeeName`, `status`).

- **Errors:**
  - `410 hold_expired`: Hold has expired, been released, or token is invalid.
  - `422 invalid_hold`: Hold event does not match `eventId`.
  - `422 validation_failed`: Empty name or invalid email format.
  - `404 event_not_found`: Event is not found or not published.

### Get public order (`GET /public/orders/:orderRef`)

Retrieves order and ticket details by human-friendly reference code.

- **Success:** `200 OK` returning `PublicOrderDto`.
- **Errors:**
  - `404 order_not_found`: Order reference not found.
