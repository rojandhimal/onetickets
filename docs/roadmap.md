# Roadmap

Two-week sprints, with a demo to real organisers at the end of each. Free tickets and check-in ship
before paid checkout, so real events can use OneTickets early. Launch is planned for May 2027 in
Sydney and Melbourne.

| Sprint | Dates                | Goal                                                                   |
| ------ | -------------------- | ---------------------------------------------------------------------- |
| 0      | 8 Oct to 13 Nov 2026 | Foundations: repo, CI, sign-up, organisations and roles, observability |
| 1      | 16 to 27 Nov         | Publish and browse: event wizard, free ticket types, event page        |
| 2      | 30 Nov to 11 Dec     | Free tickets: holds, free checkout, signed QR tickets, My tickets      |
| Buffer | 14 to 18 Dec         | Fix live-event bugs, synthesise interviews                             |
| Break  | 21 Dec to 1 Jan      | Team off                                                               |
| 3      | 4 to 15 Jan 2027     | Check-in: door scanner, offline mode, live count                       |
| 4      | 18 to 29 Jan         | Paid tickets: Stripe Connect, pricing, wallets, webhook                |
| 5      | 1 to 12 Feb          | Receipts and refunds: tax invoices, refunds, cancellations, disputes   |
| 6      | 15 to 26 Feb         | Organiser dashboard: sales, attendees, CSV, safe edits                 |
| 7      | 1 to 12 Mar          | Get paid: payouts, settlement, reconciliation, admin                   |
| 8      | 15 to 26 Mar         | Wallet passes, share kit, Companion Card, WCAG audit                   |
| 9      | 29 Mar to 9 Apr      | Big night: waiting room, bot protection, load test, runbook            |
| 10     | 12 to 23 Apr         | Launch readiness: pen test, legal, restore drill, go/no-go             |
| Launch | May 2027             | Public launch                                                          |

## Where Sprint 0 is

Done and merged: monorepo and CI (S0-1), CI security checks, Terraform and deploy pipeline (S0-2,
not applied), sign-up screens and organiser home (S0-3 web), organisations, roles and row-level
security (S0-4), e2e and accessibility tests.

In progress: the auth API (S0-3), observability (S0-5), and a one-command local Docker stack.

Sprint 0 demo, Friday 13 November: an organiser signs up and lands on an empty organiser home,
running locally.

The live board, with owners and blockers, is kept by the PM in the OneTickets project.
