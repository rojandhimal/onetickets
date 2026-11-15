# Sprint 2 acceptance: free tickets

QA, 15 Nov 2026. Checked from `main` at `c8cb168` with all core Sprint 2 stories merged: S2-1 (#50), S2-2 (#59), S2-3 (#56, #58, #83), S2-4 (#87), SEC-4 (#84), SEC-14 (#52), S2-4a (#62), SEC-21 (#56), SEC-22 (#67), SEC-23 (#71), SEC-24 (#75), and BE-7 (#79). Check-by-check criteria from [sprint-2-checklist.md](sprint-2-checklist.md).

## Verdict

**Accepted on 15 Nov 2026.** All 4 stories in Sprint 2 meet their acceptance criteria and Definition of Done on `main`. The end-to-end journey from Browse to published event page, single-screen free checkout with real-time hold notice and per-order limits, idempotent order submission, cryptographic Ed25519 offline QR ticket presentation, service-worker caching, transactional confirmation email via Mailpit with organiser Reply-To, and the read-only attendee portal ("My tickets") with hash-fragment stripping and anti-enumeration lookup passes cleanly. axe accessibility rules pass with zero violations at both 375 px and 1280 px, with no horizontal scrolling and no CSP violations. Pre-existing staging deferrals (AWS deploy, KMS remote signing, Google OAuth) carry forward.

---

## Integrated journey pass (on `main`)

### 1. S2-1 Free ticket holds and inventory (`#50`)

- **Holds authority & invariants:** Holds are recorded in Postgres in the `inventory` schema. A hold atomically increments `held` and decrements available tickets with conditional `UPDATE ... WHERE sold + held + :qty <= capacity` (INV-1). Concurrent attempts beyond capacity return `409 conflict` (1.1).
- **Hold expiry sweeper:** Expired holds are released back to inventory, restoring available capacity (1.2).
- **Availability messaging:** Tickets display "Sold out" only when `sold == capacity`. While holds occupy remaining capacity (`sold + held == capacity`), UI renders "All taken right now. Check back in a few minutes." (INV-15 / ARCH-2) (1.3).
- **Per-order limit & RLS:** Enforces $1 \le \text{qty} \le \text{max\_per\_order}$ returning `422 invalid_quantity` for out-of-bound requests (INV-4). Forced RLS prevents cross-organisation hold tampering (1.4, 1.5).

### 2. S2-2 One-screen free checkout (`#59`)

- **Responsive single-screen checkout:** Renders `/e/:slug/tickets` at 375 px and 1280 px with heading "Get your tickets", hold notice (`role="status"`), ticket steppers, name and email inputs, optional news opt-in, order summary, and primary CTA. 0 axe violations (2.1).
- **Stepper & Hold notice:** Stepper defaults to 1 for the first available type and respects available capacity and order caps. Hold notice communicates: "We're holding {n} tickets for you while you finish. Take your time." without stressful timers (2.2, 2.3).
- **Availability feedback:** Sold out rows render "Free · all taken" badge. Capacity changes at submit trigger alert banner (`role="alert"`): "Only {n} {type} tickets were left..." (2.4, 2.5).
- **Idempotency & Validation:** Order creation uses unique client idempotency key (INV-5). Retried requests return the identical order without duplicate holds or tickets. Form enforces required Name and RFC-compliant Email with inline error focus (2.6, 2.7).
- **Order conversion:** Button transitions to "Booking your tickets…", disabling re-submission. Cleanly redirects to `/tickets/:orderId#key=...` (2.8).

### 3. S2-3 Signed offline QR tickets & confirmation (`#56`, `#58`, `#83`)

- **Confirmation & Multi-ticket pager:** Renders "You're going!", destination email confirmation, attendee name, and ticket stub. Multi-ticket orders page through stubs with "Ticket {i} of {n}" (`aria-live="polite"`), accessible Prev/Next controls, and distinct QR codes (3.1, 3.2).
- **Offline service worker & display:** Scoped service worker caches ticket data and QR assets on first load, displaying "Works offline" chip when disconnected. Navigating offline renders tickets without failure. Display brightness hint guides attendees at the door (3.3, 3.4).
- **Calendar integration:** "Add to calendar" generates `.ics` download and Google Calendar web link with accurate venue, times, and timezone (3.5).
- **Cryptographic signing (ADR 0011):** QR payloads are signed with Ed25519 using environment signing keys with context `onetickets/ticket/v1`. Tokens omit buyer email and attendee personal data entirely (3.6).
- **Transactional confirmation email:** Delivered via Mailpit with subject "Your tickets for {event}, {date}". Email includes event details, cancellation policy, direct ticket link, and Reply-To pointing to organiser's contact email (3.7).

### 4. S2-4 Attendee portal & lookup (`#84`, `#87`)

- **Attendee portal (Row 4.1):** Signed-in attendee `/my-tickets` shows "Upcoming" and "Past" tabs with order cards, event date eyebrow, venue/suburb, ticket count, and "Show QR" links.
- **Anti-enumeration lookup (Row 4.2):** Unauthenticated `/my-tickets` provides email lookup. Any valid email submission returns: `"Check your email. If {email} has tickets, the link is on its way."` without disclosing account existence.
- **Fragment token security (SEC-4 / Row 4.3):** Verification links carry token in `#token=...` hash fragment. Script immediately strips the fragment via `window.history.replaceState` before verification, preventing token leakage in Referer headers or browser history. Read-only restricted session is established.
- **Clean empty state (Row 4.7):** Zero-ticket state displays "No upcoming tickets." with link "Find something on this weekend" to Browse (`/`).
- **Feature flag:** Gated behind `FEATURE_ATTENDEE_TICKETS=true`.
- **Note on Ticket release (Rows 4.4-4.6):** Per D20, attendee ticket release is deferred to a dedicated authorization workflow card.

---

## Prerequisites & Security gates

- **SEC-14 Site-wide nonce CSP:** Enforced per-request nonce CSP on all web routes. E2E CSP guard verifies zero script execution violations.
- **SEC-20 Attendee contact email:** Required organiser contact email on publish is saved and used as `Reply-To` on all buyer confirmation emails.
- **PII protection:** Public endpoints and signed QR tokens contain zero attendee personal data. Attendee database records are strictly isolated under Postgres RLS.
