# Progress: frontend

Newest first. Format: date, Done, Next, Blocked.

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
