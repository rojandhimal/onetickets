# Progress: frontend

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-24 (Claude, SEC-10 Turnstile on sign-in)

- **Done:**
  - #74 (DES-9) merged.
  - SEC-10 (#77) adds Cloudflare Turnstile to /signin, /signup and resend, behind `TURNSTILE_ENABLED` on both the web app and the api, off by default.
  - The api checks the token with siteverify before it sends a link, and fails closed with 503 `challenge_unavailable` when Cloudflare can't answer. The per-IP limit is counted before the check, and the per-email limit only after it passes.
  - The enforced CSP allows challenges.cloudflare.com only on the two sign-in pages with the flag on.
  - Cloudflare's test keys are used in Docker and tests, and the api refuses them in production.
  - Written up in ADR 0021.
  - Checks: unit tests (api, web) and api integration tests pass. A real-browser run with a stand-in Cloudflare script showed no CSP violations at 375 or 1280 px, and the fail-closed message appeared.
- **Next:** Security, QA and ProductDesign review. Then the ticket screen against the order API tegs keeps.
- **Blocked:** Real Turnstile keys come from tegs at launch. Nothing blocks the PR.

## 2026-10-24 (Claude, DES-9 share-image fonts)

- **Done:** #72 (SEC-16) merged. DES-9: the event share image now uses Bricolage Grotesque 800 and Figtree 700, as static WOFF cuts of the site's own latin subsets (42 KB together), read once per server. Render time and PNG size are unchanged (warm about 40 ms, 47 KB). Event page e2e checks the image renders.
- **Next:** ProductDesign and QA review. Then wire the ticket screen to real orders once tegs picks the order API.
- **Blocked:** Nothing.

## 2026-10-24 (Claude, SEC-16 organiser sign-out)

- **Done:** #70 (DES-8) merged. SEC-16: "Sign out" in the organiser header calls `POST /auth/sign-out`, then `clearDeviceDrafts()` even when the api fails or is offline, then loads `/signin`. Unit tests for the failure paths, and `e2e/tests/sign-out.spec.ts` at 375 and 1280 px (drafts database gone, old session cookie no longer signs in).
- **Next:** Security, QA and ProductDesign review the PR, including where the control sits.
- **Blocked:** Nothing. Wiring the ticket screen to real orders still waits on tegs's order API choice.

## 2026-10-24 (Claude, DES-8 hero buttons, #70)

- **Done:** #66 (DES-10) merged. DES-8 in #70: from 768 px the event page's Back and Share buttons line up with the 1040 px content column instead of the window edges. The event page e2e checks the alignment at 375 and 1280 px; it fails without the fix (16 px against 144 px at 1280).
- **Next:** ProductDesign reviews #70. Then wire the ticket screen to real orders once tegs picks the order API.
- **Blocked:** Nothing.

## 2026-10-23 (Claude, DES-10 sold-out bar and price note, #66)

- **Done:** #62 (S2-4a) merged. Claimed DES-10 with draft #66: the event page shows "Sold out" only when the api says every ticket is sold, and "All taken right now. Check back in a few minutes." with Get tickets kept while checkout holds fill the event (ARCH-2). Unit tests for both states.
- **Next:** ProductDesign confirms the two copy defaults ("All taken" with no number, held copy in the price row), then Design and QA review #66.
- **Blocked:** Nothing. Wiring the ticket screen to real orders still waits on tegs's order API choice.

## 2026-10-23 (Claude, S2-4a ready for review, #62)

- **Done:** Built "Remove tickets from this device" and 7-day expiry for saved tickets behind `FEATURE_TICKETS`, with Design's copy and Security's four adjustments. The worker checks expiry before serving and fails closed. Remove works offline and without the key, and takes the tickets off the screen. Unit tests, plus e2e at 375 and 1280 px for remove, reload after remove, and expiry on the next visit. All checks and 48/48 e2e pass.
- **Next:** QA, Security and Design review #62.
- **Blocked:** Nothing.

## 2026-10-23 (Claude, S2-4a claimed)

- **Done:** #56 (S2-3 ticket screen) merged. Claimed S2-4a, "Remove from this device" and expiring saved tickets, which Security made a condition of ADR 0020. PM split it out of S2-4 because it needs no order API.
- **Next:** Agree the expiry window with Design and Security, get Design's copy, and build it behind `FEATURE_TICKETS`.
- **Blocked:** Nothing. Wiring the ticket screen to the real order API waits on tegs's choice between #58 and #59.

## 2026-10-23 (Claude, S2-3 QA fixes, #56)

- **Done:** Fixed QA's two findings on #56. The page now always asks the api first (with no key header when it has none), and shows the copy saved on the phone only when that request fails. A refused keyed link deletes the saved copy. Earlier, on 22 Oct: bumped Next to 16.4.2 for three advisories, fixed the gitleaks false positives the repo's way, renumbered the ADR to 0020, and applied Design's revoked and QR-pending copy. Security and Design passed at 3336dff. All checks and 44/44 e2e pass.
- **Next:** QA re-checks 3336dff..head. Wire to the order API tegs picks.
- **Blocked:** tegs's choice between #58's and #59's order API.

## 2026-10-22 (Claude, S2-3 ready for review, #56)

- **Done:** Built artboard 4 behind `FEATURE_TICKETS`: "You're going!", one stub at a time with a touch swipe and Previous/Next, a QR drawn in the browser with Wake Lock, Add to calendar as a bottom sheet or popover, offline through a service worker scoped to `/tickets/` (ADR 0020). Applied ProductDesign's S2-3 fill-ins and the BackendDev's final orders contract (#58). The key leaves the address bar at once and stays in `sessionStorage` for the tab; checkout can stash the created order for an instant first render with `stashConfirmedOrder`. Format, lint, typecheck, all unit tests and the ticket e2e at 375 and 1280 px with axe and the CSP guard pass.
- **Next:** QA, ProductDesign and Security review #56. Import the order types from `@onetickets/shared` once #58 merges. Tell the other tool's checkout about `stashConfirmedOrder` once Security agrees the key flow.
- **Blocked:** Security's OK on the ticket key handling; Design's copy for a revoked ticket ("This ticket no longer works." is a placeholder).

## 2026-10-22 (Claude, S2-3 confirmation and ticket stub)

- **Done:** Claimed S2-3's frontend part (artboard 4: confirmation screen and ticket stub) with a draft PR. Checked main at 7023181 and the open PRs (#53, #54, #55): nothing else touches the confirmation or ticket screens. S2-2 checkout (`/e/:slug/tickets`) stays with the other tool's FrontendDev.
- **Next:** Agree the tickets api contract with the Claude BackendDev. Build "You're going!", the ticket pager, the QR card with Wake Lock, the offline cache and Add to calendar behind a runtime flag, against a typed stub until the api lands.
- **Blocked:** Nothing.

## 2026-10-21 (SEC-14 enforce CSP site-wide)

- **Done:** Implemented SEC-14 site-wide enforced CSP ([ADR 0018](/docs/adr/0018-enforced-nonce-csp-on-event-pages.md)). Exported `strictSiteCsp` in `apps/web/src/lib/security-headers.ts` and configured `apps/web/src/proxy.ts` matcher to apply the strict nonce-based CSP and `Cache-Control: private, no-store` across all page/document routes (excluding API, static assets, and images). Verified `apps/web/src/proxy.test.ts` across page routes and exclusions. Updated ADR 0018 and security checklist in `docs/security/checklist.md`. All 24 test files (156 unit tests) pass.
- **Next:** Open PR for SEC-14, obtain independent QA and Security reviews. Proceed with S2-2 (one-screen free checkout).
- **Blocked:** None.

## 2026-10-18 (SEC-20 explicit attendee contact email)

- **Done:** Continued feature development at tegs's request after verifying S1-5 merged in #44. Implemented the agreed SEC-20 part 2: visible editable viewer-email prefill, save on blur or Next, required contact checklist and focused Add/Change links, server-confirmed Review summary, and API publish refusal with `contact_email` in `missing`. A live event cannot clear its saved contact; existing empty records are not backfilled. Regression coverage includes clearing, mistyped/rejected/offline replacements, private public pages and both browser widths. Updated web and API docs. Format, lint, typecheck, 225 unit tests, 111 integration tests, production build and all 36 browser/axe/CSP checks pass at 375/1280 px; both Review layouts inspected. Integration and browser runs used separate disposable databases. The wizard remains behind `FEATURE_EVENT_WIZARD`; no infrastructure was applied.
- **Next:** Independent QA, Security and ProductDesign review this feature; tegs merges after their verdicts and CI pass. BackendDev checks compatibility with the separate BE-1 PR #46, which edits other portions of the same service. Sprint 1 acceptance remains with QA; SEC-14 is still required before checkout ships.
- **Blocked:** Required independent review verdicts pending; no product scope decision outstanding.

## 2026-10-17 (S1-5 browse upcoming events, #44)

- **Done:**
  - #35 (S1-4 Details and S1-2 offline ticket follow-ups) merged. Restarted from `main` on `frontend/s1-5-browse` and opened draft [#44](https://github.com/rojandhimal/onetickets/pull/44).
  - Built S1-5 (public browse upcoming events, design artboard 1 Discover) at `/`:
    - Server-rendered initial load (`apps/web/src/app/page.tsx`) backed by `browseEvents()` (`GET /public/events`, cached 60 s under tag `browse` and invalidated by `POST /internal/revalidate`).
    - City picker (`Near Sydney · Change` / `Near Melbourne · Change`) switching between Sydney and Melbourne (`apps/web/src/app/Browse.tsx`).
    - Single-select, deselectable `When` (`Tonight`, `This weekend`, `Next 7 days`) and `Price` (`Free`, `Paid`) filter chip groups with `aria-pressed`, matching headings (`Coming up near you`, `On tonight`, `This weekend`, `Next 7 days`), `Prices shown are what you pay. No fees added later.`, and a visually hidden `role="status"` result count (`{n} event(s)`).
    - Event cards with organiser banner (behind `FEATURE_EVENT_BANNER`, falling back to template tint and category word), `Free` badge, date eyebrow in the event's time zone, title, `suburb · venue` (or `Online`), and API-supplied all-in from price (`Free` or `From A$… all-in`, never recomputed in the web app). Each card is a single plain `<a href="/e/{slug}">` whose `aria-label` reads all four facts (ADR 0018).
    - Empty state (`Nothing on for that yet. Try Next 7 days.`), unit tests (`browse.test.ts`, `page.test.tsx`), Playwright E2E spec (`e2e/tests/browse.spec.ts` with `REVALIDATE_SECRET` wired in `e2e/playwright.config.ts`), and docs (`docs/web/README.md`, `README.md`).
  - Completed independent post-merge FrontendDev review of [#38](https://github.com/rojandhimal/onetickets/pull/38#issuecomment-6235749398) (QA-2 flaky publish e2e fix, `2eac3d6`): PASS.
- **Next:** get QA, ProductDesign and Security reviews on [#44](https://github.com/rojandhimal/onetickets/pull/44); then Sprint 1 integrated acceptance and Sprint 2 (S2-1 ticket holds and checkout).
- **Blocked:** nothing.

## 2026-10-16 (11:15 UTC, S1-4 rework, #35)

- **Done:**
  - Reworked [#35](https://github.com/rojandhimal/onetickets/pull/35) after the reviews:
    - About now uses template placeholder prompts (no saved starter text);
    - Design's three #31 fixes and the single-type delete nit;
    - offline ticket edits kept in IndexedDB and synced on reconnect, from any step and before publish (QA's #31 finding, row 1.6, its own commit);
    - QA's nits: "Use a whole number", and a mistake on Tickets is focused instead of dropped.
  - CI now prints the page snapshot and api errors when an e2e test fails (QA-2). I couldn't reproduce the publish e2e failure locally, and CI passed it at 67e2c86.
  - Security passed #35. Local checks pass: web 132 unit tests, e2e 32/32.
- **Next:** QA and Design re-reviews, CI green on bda956e, then S1-5 browse once #35 merges.
- **Blocked:** nothing.

## 2026-10-16 (06:20 UTC, S1-4, #35)

- **Done:**
  - #31 (S1-2) merged. The branch restarted from main.
  - Opened draft [#35](https://github.com/rojandhimal/onetickets/pull/35) (S1-4 Details step, artboard 8b):
    - About with the template starter paragraph (saved by one PATCH after create);
    - the Accessibility fieldset and notes;
    - Cancellations;
    - the contact email for attendees, which never appears on the public page;
    - live character counts, announced politely.
  - Locally: web 129 unit tests and 28 e2e tests pass. The e2e tests cover rows 4.1 to 4.4.
  - Asked QA, ProductDesign (three copy questions) and Security to review.
- **Next:** drive #35 to green and swap in ProductDesign's copy, then S1-5 browse.
- **Blocked:** nothing.

## 2026-10-16 (S1-2, #31)

- **Done:**
  - [#17](https://github.com/rojandhimal/onetickets/pull/17) (S1-1 create-event wizard) and [#23](https://github.com/rojandhimal/onetickets/pull/23) (S1-3 public event page and share image) merged.
  - Built S1-2 (free ticket types, Artboard 8) on `frontend/s1-2-ticket-types`:
    - `TicketsStep` (`apps/web/src/app/organiser/events/new/TicketsStep.tsx`) replaces the step 2 summary placeholder with the full free ticket type editor (`Free ticket. No fees for you or your guests.`, no Free/Paid toggle while `paid_tickets` is off).
    - Fields: `Ticket name`, `How many tickets?` (±5 stepper buttons with `5 fewer tickets` / `5 more tickets` and typed input), `Max per order`, `Sales start` (`When I publish`, `Pick a date and time`) and `Sales end` (`At start time`, `1 hour before`, `1 day before`, `When the event ends`, `Pick a date and time`), converting custom dates/times in `event.timeZone`.
    - Multiple ticket types: non-active types collapse into summary rows (`Free · {n} tickets · up to {m} per order`) with `Edit` and `Remove {name} ticket`.
    - Inline validation for capacity (`Set at least 1 ticket`), max per order (`Can't be more than {capacity}, the number of tickets`), and sales window (`Sales need to end after they start`), plus API 422/409 error handling and `version` sync with wizard autosave.
    - Added unit tests (`Wizard.test.tsx`), Playwright E2E coverage (`e2e/tests/wizard.spec.ts`), and updated `docs/web/README.md`.
- **Next:** get QA, ProductDesign and Security reviews on S1-2, then once S1-2 merges open S1-4 (accessibility and event details) followed by S1-5 (browse upcoming events).
- **Blocked:** nothing.

## 2026-10-16 (00:30 UTC)

- **Done:**
  - #17 (S1-1 wizard) merged. The branch restarted from main.
  - Opened draft #23 (S1-3 event page):
    - public /e/{slug} page and share image;
    - enforced nonce CSP and private no-store;
    - 60 s tagged data cache, plus POST /internal/revalidate for BackendDev's revalidation call;
    - new event-page e2e. Locally: web 117 unit tests and 24 e2e tests pass.
  - Asked QA, Security and ProductDesign to review.
- **Next:** drive #23 to green, then S1-2 (ticket types).
- **Blocked:** nothing.

## 2026-10-15 (13:30 UTC)

- **Done:**
  - #17: merged main in after #16 and #19 landed (7b6989f). The conflicts were only in the ADR index and .gitignore.
  - #17: CI is all green, including e2e (20 tests). It's marked ready for tegs's review.
  - Confirmed BackendDev's #22 (priceCents limit).
- **Next:** open S1-3 (event page) on the branch as soon as #17 merges. Then S1-2.
- **Blocked:** nothing.

## 2026-10-15 (evening)

- **Done:**
  - #17: ProductDesign approved it. Their final copy and focus ring are in 9e98128.
  - #17: QA's three blockers are fixed at 80636d9.
    - The flag is now read at runtime (connection()).
    - The organiser home has Upcoming and Drafts, and "Finish setting up" resumes the last step.
    - There's a wizard e2e with axe and the CSP guard.
  - The non-blocking autosave, error-wording and daylight-saving items are fixed too.
  - Locally, with #16 merged in, all 20 e2e tests pass.
- **Next:** after #16 merges, merge main into #17 and get CI green. Then open S1-3 straight after #17 merges, then S1-2, S1-4 and S1-5.
- **Blocked:** #17's e2e stays red until #16 merges (no events api on main). The merge order is with PM and tegs.

## 2026-10-15 (later)

- **Done:**
  - #17: Security's finding is fixed (e7a3d60). On-device drafts are tied to the user, wiped when another user opens the wizard, and expire after 7 days. Security passed it, and BackendDev added Clear-Site-Data on sign-out in #16.
  - #17: ProductDesign's review is fixed in one push (ae1cc66). That covers the banner upload and crop, honest save states (including the 422 field error), 44 px stepper targets and four copy fixes. The shared index.ts now matches #16's named exports.
  - Checks green locally: format, lint, typecheck, 89 web tests, next build. axe is clean at 375 px.
- **Next:** QA and ProductDesign re-review #17. Then S1-3 (built locally, share image uses ogUrl), S1-2, S1-4 and S1-5.
- **Blocked:** two copy calls are with ProductDesign: the header text for a refused field, and HEIC wording.

## 2026-10-15

- **Done:**
  - #12 merged on 10 Oct.
  - Restarted the branch from the latest main and opened [PR #17](https://github.com/rojandhimal/onetickets/pull/17) as a draft. It's S1-1, the create-event wizard, and it carries the final events contract including `BannerDto.ogUrl`.
  - Checks pass locally: format, lint, typecheck, tests (76 web) and next build.
- **Next:**
  - Drive #17 to green. Reviews from QA, Security and ProductDesign are requested via PM.
  - Then open the S1-3 event page PR after #17 merges, with the share image switched to `banner.ogUrl`.
  - After that: S1-2, S1-4, S1-5.
- **Blocked:**
  - S1-3 waits on #17 because there's one branch.
  - End-to-end testing needs BackendDev's S1 api PR.

## 2026-10-10 (later)

- **Done:**
  - Contract agreed with BackendDev; my local copy is now their events-s1.ts. I've asked them to add nullable name and times, and the places lookup.
  - Reviewed QA's #13.
  - S1-1 copy-deck fixes, plus two new errors: past date and address not picked.
  - S1-3 event page built and committed locally. It covers the key facts, banner behind FEATURE_EVENT_BANNER (on), the share image, and the enforced nonce CSP on /e/:slug (ADR 0018).
  - Results: 89 web tests pass. A Chromium run had no CSP violations, axe was clean at 375 and 1280 px, and there's no sideways scroll.
- **Next:** S1-2 ticket types, S1-4 details, S1-5 browse.
- **Blocked:**
  - S1-1 and S1-3 PRs can't open until #12 merges or tegs allows a branch per story. A decision card is with tegs.
  - The share image needs a JPEG banner rendition from BackendDev; it falls back to the template colour until then.

## 2026-10-10

- **Done:** [#12](https://github.com/rojandhimal/onetickets/pull/12) (shared auth types, ADR index) is green on all five checks and waits on tegs's review. Read the S1 design handoff. Drafted the S1 event and ticket-type contract (zod) at /project/contracts/events-s1-draft.ts and sent it to BackendDev.
- **Done (later):** S1-1 wizard built locally against the draft contract and committed (not pushed). It has template to draft, Basics (name, times, venue lookup, online link), the Review checklist with publish, and the live screen. Autosave runs on blur and every 10 s, with a version check and offline edits in IndexedDB (ADR 0016, claimed). 75 web tests pass. A real Chromium run at 375 px is clean: axe found nothing, there's no sideways scroll, and offline then back online works.
- **Next:** Open the S1-1 PR once #12 merges. Then S1-3 event page, S1-2, S1-4, S1-5.
- **Blocked:** S1-1's PR waits on #12 merging (one branch). It also needs BackendDev's events and places endpoints to work end to end.

## 2026-10-09 (late night)

- **Done:** [PR #9](https://github.com/rojandhimal/onetickets/pull/9) (S0-5 web error tracking) merged, after Security and QA fixes: a scrubbing `/csp-report` endpoint, zod jitless, and the lockfile repair after the main merge. Opened follow-up [PR #12](https://github.com/rojandhimal/onetickets/pull/12): the web app uses the shared auth types, and ADRs 0001 to 0003 are linked in the index.
- **Next:** drive #12 to green, then whatever PM puts next on the board.
- **Blocked:** nothing.

## 2026-10-09 (night)

- **Done:** fixed Security's findings on [PR #9](https://github.com/rojandhimal/onetickets/pull/9): stricter redact() key matching, scrubbers moved to `@onetickets/shared` for the api, and ADR 0003 now requires Sentry's own scrubbing. Security passed it and CI is green, so it's ready for tegs.
- **Next:** once #10 merges, switch the web contract types to `@onetickets/shared`.
- **Blocked:** nothing.

## 2026-10-09 (late)

- **Done:** [PR #9](https://github.com/rojandhimal/onetickets/pull/9) marked ready for review, with CI green. Tested sign-in end to end against BackendDev's [PR #10](https://github.com/rojandhimal/onetickets/pull/10) with real Postgres in a browser: every path works and axe reports no violations. Lined #9's docs up with the docs restructure in #8.
- **Next:** once #10 merges, switch the web contract types to `@onetickets/shared`.
- **Blocked:** nothing.

## 2026-10-09 (evening)

- **Done:** [PR #2](https://github.com/rojandhimal/onetickets/pull/2) (S0-3) merged. Opened draft [PR #9](https://github.com/rojandhimal/onetickets/pull/9): S0-5 web error tracking with its docs and ADR 0003, plus the S0-3 docs and ADRs 0001 and 0002 that missed #2's merge.
- **Next:** drive PR #9 to green; then switch web contract types to `@onetickets/shared` now that the api PR has landed.
- **Blocked:** nothing.

## 2026-10-09

- **Done:** S0-3 web sign-up and empty organiser home. [PR #2](https://github.com/rojandhimal/onetickets/pull/2) passed QA and Security, now targets main with CI green, and is ready for review. S0-5 web Sentry is built and tested on a local branch (40 web tests, live check showed no personal data sent).
- **Next:** add the docs PR #2 needs under the new working agreement (README web section, docs/web auth flow and env vars, ADRs for the magic-link token and email-first sign-in), then push S0-5 web.
- **Blocked:** S0-5 push is waiting on tegs to answer the branch card in the FrontendDev thread (own branch per story), or on PR #2 merging.
