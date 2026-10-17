# Roadmap

Two-week sprints, with a demo to real organisers at the end of each. The dates below are the
planned calendar: once every story is merged and QA accepts a sprint, the next sprint starts
straight away (tegs, 10 October). Free tickets and check-in ship before paid checkout, so real
events can use OneTickets early. Launch is planned for May 2027 in Sydney and Melbourne.

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

## Current progress: Sprint 1

QA [accepted Sprint 0 on 15 October](../project/qa/sprint-0-acceptance.md), including observability
(S0-5) and the web Docker build fix (#18). AWS remains unapplied; its deploy, email, Google sign-in
and observability checks carry forward to the first staging deploy.

Sprint 1 started early on 10 October. The events API (#16), wizard (S1-1, #17), ticket editor
(S1-2, #31), public event page (S1-3, #23) and Details/accessibility (S1-4, #35) have merged.
#35 also fixes offline ticket edits and publishing while changes are still being saved. Browse
(S1-5) is the next frontend story. Public cache/revalidation (#25/#26), Cloudflare infrastructure
(#39) and Docker image builds in PR CI (#42) have merged. Infrastructure remains unapplied.

The silent publisher-email fallback was removed in #41 (SEC-20 part 1). The visible contact-email
prefill, Review summary and saved-email publish requirement remain part 2, due before Sprint 2
sends attendee emails. The [live board](../project/pm/board.md) records review evidence, the
post-merge QA follow-up for #42 and the remaining handoff.

Sprint 1 closes only after S1-1 through S1-5 merge and QA accepts the integrated publish-and-browse
journey. SEC-14 (site-wide enforced CSP) remains required before Sprint 2 free checkout ships.

The planned 13 November organiser demo still depends on recruitment (RES-1). Until staging is
available, demos run locally or through the documented quick tunnel. Performance on 4G, real chat
previews and AWS checks remain explicit staging deferrals; local checks do not close them.
