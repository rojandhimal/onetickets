# 0010. Stripe Connect destination charges with `on_behalf_of`

- Status: Accepted (payout timing still open)
- Date: 2026-10-08
- Story: S4-3 (fold in before Sprint 4 planning)
- Deciders: tegs, from the architecture review (ARCH-1)

## Context

OneTickets sells tickets on behalf of organisers. Who is the seller (merchant of record) decides
GST treatment, refund liability, dispute liability and whose name is on the buyer's card
statement. The architecture recommended "organiser as seller, OneTickets as agent" with
destination charges, but a plain destination charge settles on the platform, which makes
OneTickets the seller.

## Options considered

- **Plain destination charges.** Simple; OneTickets becomes the seller.
- **Separate charges and transfers.** Full control over when organisers are paid; OneTickets is
  the seller again.
- **Destination charges with `on_behalf_of`.** The organiser's connected account is the
  settlement merchant, matching the agency model.

## Decision

Use Stripe Connect (Express accounts) with destination charges that set `on_behalf_of` and
`transfer_data.destination` to the organiser's connected account, and take the platform fee as
`application_fee_amount`. All of these are set by the server.

Card data only ever goes to Stripe's Payment Element (SAQ A). The `payment_intent.succeeded`
webhook, verified on the raw body, is the trigger for marking an order paid, never the browser
redirect.

## Consequences

- The organiser is the seller; OneTickets issues the platform-fee part of the tax invoice.
- The ledger records the organiser's share as moving to their Stripe balance at charge time.
- Open before Sprint 4: how long Stripe lets an Australian connected account's funds be held
  before payout (payouts are planned after the event, with staged release as the fallback), and
  the accountant's view on GST and merchant of record. Both are on tegs's setup list.
