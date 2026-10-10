# 0012. Free tickets first, with one fulfilment path

- Status: Accepted
- Date: 2026-10-08
- Story: Sprints 1 to 4
- Deciders: tegs (sprint backlog), architecture review fix 8

## Context

Paid checkout needs Stripe Connect onboarding, webhooks, the ledger, tax invoices and refunds:
the riskiest part of the product. Organisers could start running real free events much earlier,
and the team would learn from real door check-ins before money is involved. But the first design
only confirmed orders on a Stripe webhook, which free orders never produce.

## Decision

- Ship in this order: publish and browse (Sprint 1), free tickets with signed QR codes
  (Sprint 2), door check-in (Sprint 3), then paid tickets (Sprint 4).
- Write order confirmation once, as one fulfilment function (`fulfilOrder(orderId)`): free
  checkout calls it directly, and the payment webhook calls it later. Sprint 4 adds a caller, not
  a second fulfilment path.

## Consequences

- Real events on OneTickets before Christmas 2026, with demos to real organisers each sprint.
- The hold, order and ticket code is exercised by free events before money flows through it.
- Paid launch depends on Stripe and accountant answers being in hand by 18 January 2027.
