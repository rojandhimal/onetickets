# Sprint 1 acceptance: publish and browse

QA, 18 Oct 2026. Checked from `main` at `8655fc8` with all 5 Sprint 1 stories merged: S1-1 (#17), S1-2 (#31), S1-3 (#23), S1-4 (#35), and S1-5 (#44), plus hardening PRs #25, #26, #34, #37, #38, #39, #41, #42, #45. Check-by-check criteria from [sprint-1-checklist.md](sprint-1-checklist.md).

## Verdict

**Accepted on 18 Oct 2026.** All 5 stories in Sprint 1 meet their acceptance criteria and Definition of Done on `main`. The end-to-end journey from template selection, ticket creation, details/accessibility, publish checklist, live guest event page, through to public city/date browse passes cleanly. axe accessibility rules pass with zero violations at both 375 px and 1280 px, with no horizontal overflow and no CSP violations. Pre-existing staging deferrals are carried forward.

---

## Integrated journey pass (on `main`)

### 1. S1-1 Create event wizard (`#17`, `#38`)

- **Routes & Stepper:** Four dedicated steps (`/organiser/events/new/{basics,tickets,details,review}?draft=...`). Stepper rendered as `<ol>` with `aria-current="step"` on the active step and accessible completed markers on prior steps (1.1).
- **Navigation:** Back navigation returns to the prior step; the close control on Step 1 keeps the draft; existing drafts resume directly at the last visited step (1.2, 1.5).
- **Templates:** Workshop, Gig, School night, Meetup, and blank templates initialise the name placeholder, category tint, free General Admission capacity (40 / 100 / 150 / 30), and sales ending at event start time. About guidance renders as a placeholder prompt without saving unedited text (1.3, 4.4).
- **Autosave & Offline:** Edits autosave on blur and debounced on dirty state with `role="status"` ("Saving…" → "Draft saved") without locking input. Offline changes persist to IndexedDB ("Saved on this phone") and sync on reconnect without lost edits (1.4, 1.6).
- **Venue & Publish guard:** Venue lookup saves canonical place details and coordinates; switching to Online swaps in a URL field. The Publish button remains clickable with incomplete fields, displaying an alert banner (`role="alert"`) and focusing the checklist with direct links to missing steps (1.7, 1.8).
- **Success & Security:** "Your event is live" screen focuses the primary heading, provides functional copy link and Web Share integration, and links to the public event page. Forced RLS prevents cross-org read/write/publish; roles restrict publishing to owner and admin (`door_staff` gets 403); server-side HTML sanitisation neutralises script injection (1.9, 1.10, 1.11, 1.12, 1.13).

### 2. S1-2 Free ticket types (`#31`, `#35`)

- **Ticket configuration:** Supports name, capacity stepper (±5 plus typed input), max per order, and configurable sales windows in the event's time zone (2.1).
- **Validation & Inventory invariant:** Schema and API enforce capacity $\ge 1$, max per order bounds, and sales end after start. Database CHECK constraint enforces `sold + held <= capacity` (INV-1); lowering capacity updates inventory in the same transaction (2.2, 2.3, 2.4).
- **Free tickets default:** With `paid_tickets` off, Free/Paid toggle is omitted and price is locked to integer 0 cents. Multiple ticket types collapse to summary rows with accessible edit and delete triggers (2.5, 2.6, 2.7).

### 3. S1-3 Public event page (`#23`, `#25`, `#26`)

- **SSR & Caching:** Server-rendered HTML delivers event title, dates, venue, and pricing before JavaScript executes. HTML sends `Cache-Control: private, no-store` with per-request nonce CSP (ADR 0018); API read responses send `public, max-age=0, s-maxage=60, stale-while-revalidate=300`. Edits trigger `/internal/revalidate` fan-out to update web caches immediately (3.1, 3.2).
- **Responsive layout:** Mobile (375 px) displays compact banner (172 px), title, organiser byline, price, venue map thumbnail with deep-link to native maps, cancellation policy, accessibility summary, and sticky "Get tickets" bottom bar. Tablet/desktop (768 px+) displays sticky ticket card in right column (3.4, 3.5, 3.6).
- **Privacy & Previews:** Draft/unpublished events return 404. Public projections omit private organisation ID, attendee contact email, and online streaming URL. Rich Open Graph (`og:title`, `og:description`, `og:image` 1200 × 630) and Twitter Card tags render with correct fallbacks (3.7, 3.8, 3.9, 3.10).

### 4. S1-4 Accessibility details (`#35`, `#41`)

- **Accessibility fieldset:** Step 3 contains accessible fieldset with `<legend>` and 6 feature chips (Step-free access, Accessible toilet, Hearing loop, Seating available, Auslan interpreter, Quiet space) plus free text field capped at 500 characters with live character counter (4.1).
- **Public display:** Summary row renders above the fold with prominent first feature and "Details" jump link to full accessibility chip list and notes (4.2).
- **Zero-state privacy:** When empty, displays "No accessibility details yet" with "Booked? Reply to your confirmation email to ask the organiser." Public pages expose no mailto links, contact forms, or public contact email (4.3).
- **About & Policies:** Live character counters on About (2,000 characters). Cancellation policies (any time / up to 24 h / none) render accurately. Attendee contact email is strictly validated and kept private to ticket holders (4.4).

### 5. S1-5 Browse upcoming events (`#44`)

- **Catalogue discovery:** Public browse at `/` requires no authentication and filters strictly to published, upcoming events (5.1).
- **City selection:** Sydney and Melbourne city selector updates event cards dynamically (5.2).
- **Filter chips:** Single-select, deselectable When chips (Tonight, This weekend, Next 7 days) and Price chips (Free, Paid). Header reflects selected window, and results count is politely announced via `role="status"` (5.3).
- **Timezone precision:** Start and end boundaries calculate using city wall-clock time (`Australia/Sydney`, `Australia/Melbourne`) across midnight and daylight saving changes (5.4).
- **Event card UX:** Structured event cards display banner/tint, category badge, date, title, suburb · venue, and all-in price ("Free" or "From A$..."). Card is wrapped in a single link with comprehensive `aria-label` announcing title, date, venue, and price (5.5, 5.6).
- **Clean empty state:** "Nothing on for that yet. Try Next 7 days." displays when no events match active filters. Full search and category taxonomies remain omitted per MVP scope (5.7, 5.8).

---

## Automated test results & Definition of Done

- **Format, Lint, Types:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck` pass with zero warnings or errors.
- **Unit & Integration:** All unit tests pass across `@onetickets/shared`, `@onetickets/api`, and `@onetickets/web` (149/149 web unit tests). Integration test suite passes against real PostgreSQL 16 with enforced RLS and migration boundaries.
- **E2E & Accessibility:** Playwright test suite passes at both 375 px and 1280 px. axe core checks report 0 accessibility violations across wizard steps, public event page, and browse index. No sideways scrolling.
- **Security & CSP:** Enforced nonce CSP verified on public event routes; no CSP violations reported; HTML sanitisation verified by fuzzing.

---

## Deferred to staging (requires AWS infrastructure & Google OAuth client)

The following items cannot be executed in local Docker and are deferred to staging deployment:

1. **Edge CDN & Caching (Checks 3.2, 5.1):** Cloudflare edge caching, Cache-Control header propagation behind Cloudflare, and Cloud Map multi-task revalidation fan-out across multiple ECS tasks.
2. **4G Mobile Performance (Check 3.3):** p75 LCP under 1.5 s on mobile 4G profile via WebPageTest / Lighthouse on staging.
3. **External Rich Previews (Check 3.7):** Live unfurling and preview card rendering in WhatsApp, Facebook, and Instagram DM chats.
4. **Third-party Auth & Delivery:** Google OAuth flow and SES transactional email delivery.
5. **Usability Research (Check 1.14):** Formal timed usability sessions with external organisers scheduled for 9–12 November (RES-1).

---

## Sprint 1 closure

Sprint 1 is formally accepted. Development may proceed immediately to Sprint 2 (Free tickets: holds, checkout, signed QR tickets, attendee portal) in accordance with the rolling sprint policy.
