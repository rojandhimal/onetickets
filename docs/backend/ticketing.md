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

## Confirmation email (S2-3)

After committing the order and signing its tickets, checkout sends a plain-text confirmation
through the existing mail transport. It includes the event date and times in the event's time
zone, venue (including the private joining URL for online events), ticket types/references,
cancellation policy and a link to the order's ticket screen. Reply-To is the organiser's saved
contact address. These private delivery fields are never added to the public event DTO.

`checkout.order_confirmations` records only `order_id` and `sent_at`, with FORCE RLS restricted
to the verified order scope. Concurrent requests lock this receipt and check it again before
sending. Successful idempotent retries do not send another message, even if a retry changes the
submitted email: delivery uses the saved buyer address. Historic orders are not backfilled or
emailed automatically; an authenticated checkout retry can create their receipt.

The key in the email is one of the already-committed 256-bit ticket keys, stored only as a hash.
It travels in the URL fragment via `confirmationPath`; ticket reads still require the bearer
header. There is no plaintext key or message body in the delivery receipt.

Delivery attempts are limited to 20 per email per rolling hour, 60 per IP per rolling 15 minutes,
and 300 globally per rolling hour. Email/IP counter keys are SHA-256 hashes. Failed attempts
consume budget; a previously sent receipt does not. Concurrent retries can conservatively consume
more than one attempt, but only one sends. The global cap logs a fixed message without personal data.

If SMTP/SES fails, checkout returns `503 confirmation_email_unavailable`; a send cap returns
`429 rate_limited`. The order, sold stock, tickets and keys remain committed. Retry the **same
idempotency key and original hold tokens** to finish delivery without booking again. There is no
background resend worker in this change. A legacy event with no valid organiser contact also
returns 503 until that address is fixed; no fallback address is invented. SMTP has bounded
connection/socket timeouts; SES sends have a 10-second abort timeout.

The transport call and Postgres receipt cannot commit atomically. If mail is accepted but the
connection or database commit fails, a retry can send a duplicate email; it cannot duplicate the
order or tickets. A delivery receipt means the transport accepted the message, not that the
recipient opened it.

Use SMTP/Mailpit locally to inspect delivery. The development console transport prints only a
fixed omission notice for confidential ticket mail, and remains a stub (no delivery). The test
outbox keeps messages in memory. Neither console, SMTP nor outbox is allowed in production; SES
supports the same Reply-To header. No new external provider or dependency is introduced.

The email links to the existing ticket screen for QR display, offline saving and calendar actions.
It does not promise an attached PDF, My tickets portal or release link before those exist. Independent
ProductDesign review covers the email copy; QA and Security review the delivery and migration.
Keep booking/ticket runtime flags until acceptance, including the outstanding checkout re-review.

## AWS signing

DEV-8 (#80) defines the key and worker role only. It does not create the worker, implement a KMS
signer or apply infrastructure. The local signer still refuses production, so AWS tickets remain
unsigned until that path is implemented and reviewed.
