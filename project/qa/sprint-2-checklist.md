# Sprint 2 QA checklist: free tickets

Owner: QA thread. Sources: the acceptance criteria in the [MVP sprint backlog](https://claude.ai/code/artifact/908caae3-7868-4e89-9a10-4da3f5d376ae), the design handoff [handoff-s2.md](/project/design/handoff-s2.md) (canvas v18/v26), the final [copy sheet](/project/design/copy-s0-s2.md), [ADR 0007](/docs/adr/0007-postgres-is-the-authority-for-stock-and-money.md), [ADR 0011](/docs/adr/0011-signed-offline-qr-tickets.md), [ADR 0018](/docs/adr/0018-enforced-nonce-csp-on-event-pages.md), and the test strategy in [test-strategy.md](test-strategy.md). Prepared on 18 Oct 2026. Statuses: ⬜ not run, ✅ passed, ❌ failed, ⏸ needs staging.

Every story must meet the Definition of Done:

- CI runs against real Postgres with enforced RLS.
- Screens work at 375 px, by keyboard and with a screen reader. axe at 375 and 1280 px is enforced by e2e, with no horizontal scrolling and no CSP violation.
- The module boundary rule passes (`./scripts/check-boundary-rule.sh`).
- An inventory or money change comes with an invariant test (INV-1, INV-4, INV-5, INV-15).
- Unfinished work sits behind a runtime feature flag.
- Repo documentation is updated in the same PR.

"Auto" means a test in CI; the layer is in brackets.

---

## S2-1 Free ticket holds and inventory

| #   | Check                                                                                                                                                                                                                                                                                            | How                                                                               | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------ |
| 1.1 | **Holds authority (INV-1):** Holds are tracked in Postgres in the `inventory` schema. A hold atomically increments `held` and decrements available tickets with a conditional `UPDATE ... WHERE sold + held + :qty <= capacity`.                                                                 | Auto (integration: concurrent hold attempts past capacity; mutation check)        | ✅     |
| 1.2 | **Hold expiry sweeper:** A background sweeper or cleanup task releases expired holds (default 20 minutes max lifetime, renewed in 5-minute increments). Released holds decrement `held` and return stock to available.                                                                           | Auto (integration: seed an expired hold, trigger sweeper, assert `held` restored) | ✅     |
| 1.3 | **Sold out vs Held (INV-15 / ARCH-2):** An event or ticket type only displays "Sold out" when `sold == capacity`. While holds account for remaining capacity (`sold + held == capacity`), it displays "All taken right now. Check back in a few minutes." with Get tickets remaining accessible. | Auto (integration & e2e: hold all remaining tickets without booking; verify copy) | ✅     |
| 1.4 | **Per-order limit guard (INV-4):** The API refuses hold requests for quantity $> \text{max\_per\_order}$ or quantity $< 1$ with `422 invalid_quantity`.                                                                                                                                          | Auto (integration 422 with `field: 'quantity'`)                                   | ✅     |
| 1.5 | **Tenancy & RLS:** Hold and inventory tables enforce forced RLS. Org A cannot view or manipulate holds for Org B. Direct SQL modifications bypassing inventory constraints fail.                                                                                                                 | Auto (integration RLS check)                                                      | ✅     |

---

## S2-2 One-screen free checkout

| #   | Check                                                                                                                                                                                                                                                                             | How                                                                     | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| 2.1 | **Single screen layout:** Heading "Get your tickets", hold notice (`role="status"`, indigo tint), ticket stepper per type, name input, email input, optional organiser news opt-in, order summary, and primary CTA. Works at 375 px and 1280 px.                                  | Auto (e2e at 375 px and 1280 px; axe 0 violations)                      | ⬜     |
| 2.2 | **Stepper behaviour:** Min 0, max is the minimum of `max_per_order` and available spots. Arriving with 1 type preselects 1. With multiple types, the first available preselects 1 and others 0. Button label reads "Get {n} free tickets" (or "Choose at least 1 ticket" when 0). | Auto (e2e)                                                              | ⬜     |
| 2.3 | **Hold notice copy:** "We're holding {n} tickets for you while you finish. Take your time." No stressful countdown timer. Heartbeat renews hold every 5 minutes while user is active on the page.                                                                                 | Auto (e2e with fake timer)                                              | ⬜     |
| 2.4 | **Sold out row:** When a ticket type is sold out, displays "Free · all taken" with a "Sold out" badge instead of a stepper.                                                                                                                                                       | Auto (e2e)                                                              | ⬜     |
| 2.5 | **Ran out on submit:** If fewer tickets remain at submit than requested, displays error banner (`role="alert"`), moves focus to the alert: "Only {n} {type} tickets were left. We've changed your order to {n}. Check it and try again." Stepper updates to available quantity.   | Auto (e2e / integration)                                                | ⬜     |
| 2.6 | **Idempotency (INV-5):** Checkout submission sends a unique client idempotency key. Submitting twice in parallel or retrying a network failure returns the same confirmed order and creates no second hold or duplicate tickets.                                                  | Auto (integration: parallel requests with same key; e2e repeated click) | ⬜     |
| 2.7 | **Form validation:** Required fields (Name, Email). Inline error announcements follow S0 pattern. Email validation displays "Add the part after the @, like gmail.com" with focus moved to the first invalid field. Opt-in is unchecked by default and labelled "(optional)".     | Auto (e2e: error states, keyboard focus, ARIA attributes)               | ⬜     |
| 2.8 | **Submission state:** Button transitions to "Booking your tickets…", `aria-disabled="true"`, preventing double submission. Upon success, redirects cleanly to the confirmation screen (`/tickets/:orderRef`).                                                                     | Auto (e2e)                                                              | ⬜     |

---

## S2-3 Signed QR tickets & confirmation

| #   | Check                                                                                                                                                                                                                                                 | How                                                                                     | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| 3.1 | **Confirmation screen:** Displays "You're going!", destination email ("We've also emailed your tickets to {email}"), ticket stub with QR code, attendee name, ticket type, and reference code.                                                        | Auto (e2e)                                                                              | ⬜     |
| 3.2 | **Multi-ticket pager:** If order contains multiple tickets, renders one ticket stub at a time with "Ticket {i} of {n}" (`aria-live="polite"`), accessible Previous/Next buttons, and swipe gesture support. Each ticket has its own distinct QR code. | Auto (e2e)                                                                              | ⬜     |
| 3.3 | **Offline capability:** Service worker caches ticket details and QR code on first load. "Works offline" chip displays when cached. Navigating to the ticket page offline renders tickets cleanly.                                                     | Auto (e2e with Playwright offline mode)                                                 | ⬜     |
| 3.4 | **Display brightness hint:** Displays note "Screen brightness goes up while this is open so the door can scan it." Invokes Screen Wake Lock API / full-white QR presentation where supported.                                                         | Auto (unit & e2e)                                                                       | ⬜     |
| 3.5 | **Calendar integration:** "Add to calendar" generates valid `.ics` download and Google Calendar web link with event times, venue/online details, and title.                                                                                           | Auto (unit for ICS generation; e2e href assert)                                         | ⬜     |
| 3.6 | **Cryptographic QR signature (ADR 0011):** QR payload is signed with Ed25519 using the event/organiser private key. The payload contains ticket ref, event ID, and signature. Payload contains NO attendee personal data (name or email).             | Auto (integration & unit: verify signature with public key; verify absence of PII)      | ⬜     |
| 3.7 | **Confirmation email:** Transactional confirmation email is sent to buyer with subject "Your tickets for {event}, {date}". Body contains event details, cancellation policy, Reply-To pointing to organiser's contact email, and ticket links.        | Auto (integration asserting email sent to Mailpit, headers, Reply-To, and body content) | ⬜     |

---

## S2-4 Attendee portal (My tickets) & ticket release

| #   | Check                                                                                                                                                                                                                                                                                            | How                                                                                   | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------ |
| 4.1 | **Signed-in view (magic link):** Accessing via attendee magic link displays "My tickets" with two tabs: "Upcoming" and "Past". Each card shows event date, title, suburb/venue, ticket count, and "Show QR" button.                                                                              | Auto (e2e)                                                                            | ⬜     |
| 4.2 | **Signed-out ticket lookup:** Unauthenticated visit to `/my-tickets` shows "Find your tickets" with email input and "Email me a link". Submitting displays "Check your email. If {email} has tickets, the link is on its way." without revealing whether tickets exist (no account enumeration). | Auto (e2e: assert constant confirmation message regardless of email existence)        | ⬜     |
| 4.3 | **Ticket magic link security (SEC-4):** Attendee magic link is scoped to read-only ticket access for that email address, valid for 15 minutes, never leaked in Referer or logs, and sets a restricted session.                                                                                   | Auto (integration: verify expiry, scope, and token invalidation)                      | ⬜     |
| 4.4 | **Ticket release flow:** Attendee can release a free ticket before the event. Modal/confirmation prompts: "Release this ticket? Your spot goes back on sale and the QR stops working." Confirming marks ticket released and decrements `sold`.                                                   | Auto (e2e & integration: release ticket, verify inventory increments available spots) | ⬜     |
| 4.5 | **Revocation enforcement:** A released ticket's QR code is invalidated in the database. When scanned or verified, it returns status "Released" / invalid.                                                                                                                                        | Auto (integration: verify verification fails on released ticket)                      | ⬜     |
| 4.6 | **Release email notification:** Releasing a ticket sends confirmation email "You've released your ticket for {event}".                                                                                                                                                                           | Auto (integration via Mailpit assertion)                                              | ⬜     |
| 4.7 | **Empty state:** When no tickets are upcoming, displays "No upcoming tickets." and a link "Find something on this weekend" directing to Browse.                                                                                                                                                  | Auto (e2e)                                                                            | ⬜     |

---

## Prerequisites & Security gates

| #   | Check                                                                                                                                                                                                                                     | How                                    | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------ |
| P.1 | **SEC-14 Enforced CSP site-wide (ADR 0018):** Strict CSP with per-request nonce enforced across all web routes (checkout, my-tickets, etc.), not just `/e/:slug`. No inline scripts without nonce. e2e CSP guard passes across all pages. | Auto (e2e CSP guard on all new routes) | ✅     |
| P.2 | **SEC-20 Part 2 Attendee contact email:** Required contact email on publish merged (#48). Order confirmation email uses this saved address for Reply-To so attendee replies go directly to the organiser.                                 | Auto (integration email check)         | ⬜     |
| P.3 | **PII protection:** Public endpoints and QR codes never disclose buyer email or full attendee PII. Attendee emails in database are subject to RLS and accessed only by the attendee session or authorised organiser roles.                | Auto (integration RLS check)           | ⬜     |

---

## Sprint 2 demo run

- [ ] On staging, at 375 px: navigate from Browse to a published free event page.
- [ ] Select tickets, complete one-screen checkout with name and email, and confirm the order.
- [ ] Verify arrival on confirmation page with interactive QR ticket stub.
- [ ] Test offline caching: turn off network, reload ticket page, and confirm QR ticket remains visible with "Works offline" chip.
- [ ] Check email in test inbox / staging mail for ticket confirmation with inline QR and organiser Reply-To.
- [ ] Follow magic link to "My tickets", view upcoming tickets, and release one ticket.
- [ ] Verify released ticket returns to available inventory on the event page.
- [ ] Time the checkout flow from event page to confirmed ticket.
