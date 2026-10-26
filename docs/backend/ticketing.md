# Orders and tickets

How free orders (S2-2) and signed QR tickets (S2-3) work inside the api. Routes are in
[api/orders.md](../api/orders.md); the token format and keys are decided in
[ADR 0011](../adr/0011-signed-offline-qr-tickets.md).

## Making an order

`OrdersService.create` runs one transaction:

1. Claims the idempotency key in `checkout.order_requests` with a new order id and a digest of the
   holds (SHA-256 over each hold id and its token's hash). A parallel submit with the same key waits
   on that row. If the key is already taken, the holds must match the digest, and the existing
   order comes back with a new key.
2. Converts each hold (`HoldsService.convert`, in id order so concurrent checkouts lock alike).
   Any lapsed, released or used hold fails the whole order and rolls everything back.
3. Puts the order in scope (`app.order_id`), inserts `checkout.orders` with the buyer's name and
   email, and issues one unsigned `ticketing.tickets` row per ticket.
4. Stores the SHA-256 of a new 256-bit ticket key in `checkout.order_keys`, valid until the event
   ends plus 7 days.

After the commit, `TicketsService.signOrder` signs the order's unsigned tickets if this process
has a signer. Signing claims rows with `for update skip locked` and only where `signature is null`,
so racing signers sign each ticket once.

## Row-level security

All tables use FORCE row-level security, like every tenant table ([tenancy](tenancy-and-access.md)).

| Table                     | `ot_app` may                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.orders`         | read its own organisation's orders, or the order in scope; insert only the order in scope, for a published event                               |
| `checkout.order_requests` | read and insert (addressed by idempotency key, holds no personal data)                                                                         |
| `checkout.order_keys`     | read and insert (addressed by key hash, like sessions)                                                                                         |
| `ticketing.tickets`       | read its organisation's tickets or the order in scope; insert for the order in scope and its published event; write only the signature columns |

Nothing is updated or deleted by the api, except the signature columns, which a trigger lets be
set once and never changed. Tickets are revoked (`revoked_at`), never deleted. `ot_worker` (the
future signing worker) may read tickets and write only the signature columns.

## Signing keys

`TicketSigner` is the only way to sign. `signTicket(payload)` signs the context
`onetickets/ticket/v1` followed by the payload. `LocalEd25519Signer` takes a 32-byte seed from
`TICKET_SIGNING_KEY` and refuses to exist outside development and test. In AWS the signing worker
will use KMS; until then tickets there stay unsigned. The redactor scrubs `ticketKey`,
`TICKET_SIGNING_KEY` and `#key=` in links.
