# 0009. Money in integer cents, one pricing function, double-entry ledger

- Status: Accepted
- Date: 2026-10-08
- Story: S4-2, S4-4, S5-3
- Deciders: tegs, from the system architecture

## Context

OneTickets holds money for organisers. Organiser balances, platform fees, GST and refunds must
reconcile with Stripe to the cent, with an audit trail. Prices must be shown all-in and
GST-inclusive from the first screen (Australian Consumer Law), and the price a buyer sees on the
event page, at checkout, on the receipt and on the invoice must be the same number.

## Decision

- Money is whole cents in integers (`Cents` in `packages/shared/src/money.ts`, `bigint` in
  Postgres), in AUD with an explicit currency. Never floats.
- One pricing function computes ticket price, fees and GST. Every screen, receipt and invoice
  calls it; nothing computes fees on its own. Prices are computed on the server; the client sends
  ticket type ids and quantities.
- A double-entry ledger records every money movement. Journals must balance and are append-only:
  a correction is a new reversing journal, never an update.
- A daily job reconciles the ledger with Stripe, and a mismatch blocks that organiser's next
  payout.

## Consequences

- No rounding drift, and one place to change fee rules.
- The ledger shape depends on the Stripe charge model (see ADR 0010).
- Whether GST applies to the processing fee is an open question for the accountant before
  Sprint 4.
