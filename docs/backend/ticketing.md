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

## Remaining S2-3 work

As of main `7f12317` (#59), order creation already issues ticket rows and calls
`TicketsService.signOrder` after commit. The ticket screen and offline controls landed in #56
and #62. Build on these implementations; the earlier competing order-API proposal is obsolete.

The next local feature is the transactional confirmation email in
[Sprint 2 checklist row 3.7](../../project/qa/sprint-2-checklist.md):

- Send to the buyer with subject “Your tickets for {event}, {date}”. Include event details,
  cancellation policy and ticket links, using the existing design copy.
- Put the organiser's contact email in Reply-To. SEC-20 made it an explicit required publish
  field; do not expose it in public event data or silently substitute another address.
- Use the existing order-scoped ticket key and `confirmationPath` contract. Bearer keys belong
  in the link fragment and the API's Authorization header, never a path/query or log.
- Cover the message, headers and links through Mailpit with fake `example.test` buyers. Preserve
  order idempotency and test delivery failure/retry behaviour without duplicate orders or tickets.

Claim S2-3 before implementation and obtain independent QA, Security and ProductDesign review.
Keep the existing booking/ticket runtime flags until acceptance. The merged checkout's final
changes still need independent QA/Security re-review; the PM status update is not that review.

AWS signing remains separate outstanding work: DEV-8 (#80) defines the key and worker role only.
It does not create the worker, implement a KMS signer or apply infrastructure. The local signer
still refuses production, so AWS tickets remain unsigned until that path is implemented and reviewed.
