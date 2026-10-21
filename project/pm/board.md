# OneTickets sprint board

Owner: PM thread ([PM](https://claude.ai/code/project/chan_01VQueTZ8BaEA4xeZ64T5fef?thread=cmsg_01VQueTZ8BaEA4xeZ64T5fefNqxFMiFUjcXL1ZifQpfAfY)). Source plan: [OneTickets MVP Sprint Backlog](https://claude.ai/code/artifact/908caae3-7868-4e89-9a10-4da3f5d376ae).
Last updated: 21 Oct 2026 by PM (PR #50 S2-1 passed QA and Security reviews; marked ready for tegs). Other threads: send changes to PM rather than editing this file directly. [PM progress](progress/pm.md).

## Where we are

**Phase:** Sprint 1 closed 18 Oct ([QA acceptance](/project/qa/sprint-1-acceptance.md)). Sprint 2 is in progress. Rule from tegs: once a sprint is done and QA has accepted it, the next one starts straight away, without waiting for the planned date.
**Health:** 🟢 Sprint 1 is complete and merged to main (#17, #31, #23, #35, #44). BE-1 (#46), Docs sign-in (#47), SEC-20 part 2 (#48), and Sprint 1 rollup (#49) are merged. S2-1 (#50) has passed QA and Security reviews and is in the merge queue.
**Next milestone:** Sprint 2 (Free tickets: S2-1 ticket holds, S2-2 free checkout, S2-3 signed offline QR tickets, S2-4 My tickets attendee portal). SEC-14 (site-wide CSP) is the next prerequisite before S2-2 free checkout ships. One branch per role, at most two active cards.

**Merge queue for tegs:**

- **PR #50** (S2-1: free ticket holds and inventory, `fcc6142`): Security pass ([comment](https://github.com/rojandhimal/onetickets/pull/50#issuecomment-6316300129)), QA pass ([comment](https://github.com/rojandhimal/onetickets/pull/50#issuecomment-6316316199)), all 7 CI checks green. Marked ready for tegs to merge.

**Review follow-up:** #42 QA-3 post-merge review completed with explicit verdict `QA: pass at 532c207` ([comment](https://github.com/rojandhimal/onetickets/pull/42#issuecomment-6236214571)). All open PRs now have explicit independent QA and Security verdicts.

**Local branch reconciliation:** the unfinished `codex/frontend-s1-ticket-editor` work predates #31/#35 and is preserved separately. Its editor must not replace the merged implementation. BE-5 tracks evaluating its safe-create-retry idea against current main; the old migration number 0007 is already used by #34. Its earlier local test results are not evidence for current main or Sprint 1 acceptance.

### Sprint 1 acceptance handoff

- QA-1 reconciled checklist rows 1.3, 3.2 and 4.3 in merged #29, with starter About explicit in
  row 4.4. The accepted rules are: each template's About guidance ships in S1-4 as placeholder prompts, not prefilled text (ProductDesign, 16 Oct); event HTML is `private, no-store`
  with a 60-second Next data cache and API revalidation; public pages never expose contact email.
- Public cache headers and per-task revalidation are now on main via #25/#26. QA's next integrated
  acceptance pass uses that merged implementation; the earlier combined-branch reviews remain
  historical evidence, not a substitute for acceptance on main.
- Once S1-5 merges, QA runs the integrated template → ticket types → accessibility
  → publish → guest event page → city/date browse journey at 375 px and 1280 px, with axe and the
  CSP guard. Consolidate the merged-story review evidence in the Sprint 1 acceptance note.
- Keep staging-only checks explicit: 4G p75 performance, real chat previews, AWS deploys, SES,
  Google OAuth and edge/header checks. Sprint 0's accepted staging deferrals still apply.
- Start Sprint 2 as soon as QA accepts Sprint 1. SEC-14 stays a prerequisite for shipping free
  checkout, and links into `/e/:slug` stay plain `<a>` until that work lands (ADR 0018).

## Sprint calendar

| Sprint                     | Planned dates (we move on early once QA accepts) | Goal                                                    | Status                                                               |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Pre-sprint                 | 8 Oct 2026                                       | Designs, research plan and decisions ready for Sprint 0 | 🟢 Done                                                              |
| 0 Foundations              | 8 Oct to 13 Nov (started early)                  | Repo, CI, environments, sign-up, roles, observability   | 🟢 Done 15 Oct ([QA acceptance](/project/qa/sprint-0-acceptance.md)) |
| 1 Publish and browse       | 16 to 27 Nov (started 10 Oct)                    | Event wizard, free ticket types, event page, browse     | 🟢 Done 18 Oct ([QA acceptance](/project/qa/sprint-1-acceptance.md)) |
| 2 Free tickets             | 30 Nov to 11 Dec                                 | Holds, free checkout, signed QR tickets, My tickets     | 🟡 In progress                                                       |
| Buffer                     | 14 to 18 Dec                                     | Fix live-event bugs, synthesise interviews              | ⚪                                                                   |
| Break                      | 21 Dec to 1 Jan                                  | Team off                                                | ⚪                                                                   |
| 3 Check-in                 | 4 to 15 Jan 2027                                 | Door scanner, offline mode, live count                  | ⚪                                                                   |
| 4 Paid tickets             | 18 to 29 Jan                                     | Stripe Connect, pricing, wallets, webhook               | ⚪                                                                   |
| 5 Receipts and refunds     | 1 to 12 Feb                                      | Tax invoices, refunds, cancellations, disputes          | ⚪                                                                   |
| 6 Organiser dashboard      | 15 to 26 Feb                                     | Home, sales, attendees, CSV, safe edits                 | ⚪                                                                   |
| 7 Get paid                 | 1 to 12 Mar                                      | Payouts, settlement, reconciliation, admin              | ⚪                                                                   |
| 8 Wallet and accessibility | 15 to 26 Mar                                     | Wallet passes, share kit, Companion Card, WCAG audit    | ⚪                                                                   |
| 9 Big night                | 29 Mar to 9 Apr                                  | Waiting room, bot protection, load test, runbook        | ⚪                                                                   |
| 10 Launch readiness        | 12 to 23 Apr                                     | Pen test, legal, restore drill, onboarding, go/no-go    | ⚪                                                                   |
| Launch                     | May 2027                                         | Public launch, Sydney and Melbourne                     | ⚪                                                                   |

## Board: Sprint 1 and follow-ups

WIP limit: 2 cards in progress per builder.

Team (Claude threads, orchestrated by PM): BackendDev, FrontendDev, QA (test strategy, PR checks against acceptance criteria), DevOps (S0-2 Terraform and deploy pipeline, S0-5 infra alarms), Security reviewer (threat model, reviews of auth, RLS, migrations, PII), ProductDesign (owns the design canvas, handoff specs, Sprint 1 and 2 designs, research prep). tegs reviews and merges PRs. Repo documentation thread owns README and docs/. Everyone follows the [working agreement](/project/pm/working-agreement.md): each PR updates its docs, and each thread logs progress in pm/progress/. CI ownership: BackendDev owns the main CI workflow (QA adds the test harness to it), Security reviewer owns a separate security workflow, and DevOps owns the deploy workflows.

### Backlog

- QA-3 Post-merge DEV-4 review (QA): verify #42 at `532c207` against the Docker-image CI criteria and record an explicit verdict. Security/DevOps passes and seven successful checks are present; they do not replace the required QA review
- BE-5 Ticket-create retry hardening evaluation (BackendDev with FrontendDev; QA and Security review): compare current main's per-tab queue with a lost successful POST response or two tabs replaying a kept new type (ADR 0016). Reproduce before proposing a narrow fix; evaluate the preserved local idempotency receipt approach without importing its duplicate UI. Use a fresh migration number and current-main tests if adopted. This is a follow-up, not a new Sprint 1 acceptance blocker
- DEV-6 SEC-5 follow-ups (DevOps, before staging / any dual-stack change): document that Free combines sign-in and CSP reports in one 20-per-10-second counter (shared-NAT impact), and add Cloudflare IPv6 ranges if the ALB becomes dual-stack. Other #39 QA notes are already resolved or covered by the README: target health checks bypass listener rules, path matching handles case/slashes and ignores query strings, and ranges must be checked before apply

- DES-8 Non-blocking #23 follow-up (FrontendDev, ProductDesign review): align wide-screen hero buttons to the 1040 px content column when next touching that layout. [Design review](https://github.com/rojandhimal/onetickets/pull/23#issuecomment-6205215064)
- DES-9 Optional #23 follow-up (FrontendDev): bundle Bricolage Grotesque in the share image if cheap; no new service or cost is authorised. Same design review; not a Sprint 1 blocker
- DES-10 Before enabling S2 booking (FrontendDev, ProductDesign and QA): implement the sold-out bar and price-note copy from the same review; preserve ARCH-2's distinction between held and sold tickets
- DEV-5 Before first AWS staging (BackendDev and DevOps, Security review): finish the S3 banner adapter and the S3/CloudFront/public-base-URL wiring in [infra's staging prerequisites](/infra/README.md). Local banner storage remains the current setup; AWS stays unapplied
- SEC-20 Contact-email default, part 2 (BackendDev and FrontendDev; QA, Security and ProductDesign review; before Sprint 2 sends attendee emails): part 1 merged in #41, removing the silent publisher-email fallback. Publishing without an email is still allowed. Complete the agreed saved-email publish check (`contact_email` in `missing`, checklist item "Contact email for attendees"), visible editable prefill with the signed-in user's email and Review's "Replies from attendees go to {email} · Change". No backfill for existing drafts
- SEC-17 Optional hardening from #16 / #19 (BackendDev, Security review): use column-scoped update grants so `ot_app` cannot change `ticket_types.event_id`, and document how owner backfills work under FORCE RLS. [Security notes](/project/pm/progress/security.md); not a Sprint 1 blocker
- ARCH-1 Blocking fix: Stripe charges use on_behalf_of so the organiser is the seller. Fold into S4-3 acceptance criteria before Sprint 4 planning ([architecture review](https://claude.ai/code/artifact/01a2857b-b93c-4784-bffa-af9f6962663f))
- ARCH-2 Blocking fix: waiting room must not show "sold out" while tickets are only held. Fold into S9-1 acceptance criteria
- SEC-1 Card-testing defences (Turnstile, rate limits per IP/email/card, Radar rules, decline-spike alert) move from S9-2 into S4-3
- SEC-2 S4-4: verify Stripe webhook signature on raw body and re-fetch the PaymentIntent before fulfilling
- SEC-3 S1-1/S1-3: sanitise event descriptions server-side, CSP on the event page
- SEC-4 S2-4: buyer ticket magic link is read-only, longer-lived, never logged or leaked in Referer
- SEC-7 Before S3-1/S6-6 reach real users: member invites become pending invites that need acceptance (BackendDev)
- SEC-8 Before S7 payouts: user-level security log (audit log is per organisation) that emails and logs recovery-code use and MFA reset. The MFA-enabled email already shipped in #10 (BackendDev)
- SEC-9 Before launch: scheduled cleanup of spent magic links (they hold emails, so Privacy Act retention), OAuth states, rate-limit rows and expired sessions (BackendDev)
- SEC-10 Before public launch: Turnstile on sign-in (FrontendDev). The MAGIC_LINK_HOURLY_CAP setting and its alarm are in [PR #21](https://github.com/rojandhimal/onetickets/pull/21) (DevOps). The Cloudflare rate limits and sentry-trace stripping moved to SEC-5
- SEC-11 First staging deploy: QA checks that a spoofed X-Forwarded-For through the ALB still gets a 429 (QA)
- SEC-13 Later: forwarded "Ask the organiser" contact form with rate limits, no email disclosure, abuse reporting (Security shapes; FrontendDev, BackendDev). Attendee confirmation emails carry the organiser's address in Reply-To only
- SEC-14 Must-have before Sprint 2 free checkout ships: enforce CSP across the whole site, not only /e/:slug, and review 'unsafe-inline' styles (ADR 0018) (FrontendDev, Security)
- DEV-2 After AWS accounts exist: AWS Agent Toolkit on tegs's machine with a read-only staging profile, for logs, costs and failed deploys. Not in the repo, not for the cloud threads (DevOps)
- SEC-15 Before launch: per-user rate limit on banner uploads and image processing concurrency 1, so one account can't starve the api (BackendDev)
- SEC-16 When the web sign-out control is built: call clearDeviceDrafts() (FrontendDev). The api side, Clear-Site-Data on sign-out, shipped in #16
- DES-7 Sprint 10 designs (canvas v29, [handoff-s10.md](/project/design/handoff-s10.md)). Defaults to confirm with tegs before Sprint 10: the founding offer waives only the OneTickets fee (card fees still apply); the data export link expires after 7 days. The Eventbrite and TryBooking export steps need checking before launch
- BE-1 From QA's #16 and #23 reviews, not blocking (BackendDev unless noted). Organisation-name cleanup (#34) and DEV-4 (#42) have merged. Remaining: live events that move into the past, server-side place resolution and a narrower public projection than the events_public row policy; coordinate with SEC-20 part 2
- ARCH-5 Before the Sprint 9 load test: if QA 3.3 (p75 LCP < 1.5 s on 4G) misses on staging, revisit event-page caching: hash-based CSP or edge-cached HTML instead of private, no-store (FrontendDev, Security)
- ARCH-4 Before launch: choose a real venue-lookup provider for /places (it uses a fixed venue list today). Needs a cost line and tegs's sign-off (BackendDev)
- SEC-6 Before production holds real data: Postgres sslmode=verify-full with RDS CA bundle (BackendDev, DevOps)
- (Source: [threat model](/docs/security/threat-model.md), 16 ranked risks. Fold into the backlog doc at each sprint's planning)
- ARCH-3 About 6 smaller fixes from the architecture review, to triage at Sprint 0 planning

### Ready

- **Next: S2-1 ticket holds and order expiry** (BackendDev): inventory holds table, sweeper, conditional reserve UPDATE, hold countdown. Reviews: QA and Security.
- **SEC-20 Contact-email default, part 2** (BackendDev and FrontendDev; QA, Security and ProductDesign review): complete the agreed saved-email publish check (`contact_email` in `missing`, checklist item "Contact email for attendees"), visible editable prefill with the signed-in user's email, and Review's "Replies from attendees go to {email} · Change". No backfill for existing drafts.
- **SEC-14 Enforce CSP site-wide** (FrontendDev, Security): enforce CSP across all routes before Sprint 2 free checkout ships (ADR 0018).

### In progress

- RES-1 Recruit 8 organisers and 6 attendees for discovery interviews: tegs (pack ready; fill in screener and video links)
- PRE-1 UI design canvas: waiting on tegs about the banner on the event page ([UI design](https://claude.ai/code/project/chan_01VQueTZ8BaEA4xeZ64T5fef?thread=cmsg_01VQueTZ8BaEA4xeZ64T5fefGvsnZc76CTuXRbT6sWV6aW))

### Review

- **PR #50** (S2-1: free ticket holds and inventory, `fcc6142`): BackendDev opened; QA pass ([comment](https://github.com/rojandhimal/onetickets/pull/50#issuecomment-6316316199)), Security pass ([comment](https://github.com/rojandhimal/onetickets/pull/50#issuecomment-6316300129)), all 7 CI checks green. Marked ready for tegs to merge.

### Done

- SEC-20 Contact-email default, part 2 ([#48](https://github.com/rojandhimal/onetickets/pull/48)), merged 21 Oct as `717cb69`; QA pass, ProductDesign approved, Security pass. Visible editable prefill on Details and required email publish check in place
- Docs: local email sign-in & Mailpit inbox ([#47](https://github.com/rojandhimal/onetickets/pull/47)), merged 21 Oct as `0eebb7a`; QA and Security pass, all 7 checks green
- BE-1 Catalogue backend hardening ([#46](https://github.com/rojandhimal/onetickets/pull/46)), merged 21 Oct as `afb1f52`; QA and Security pass, all 7 checks green
- Sprint 1 acceptance rollup ([#49](https://github.com/rojandhimal/onetickets/pull/49)), merged 21 Oct as `88a4486`; QA and Security pass
- S1-5 Browse upcoming events ([#44](https://github.com/rojandhimal/onetickets/pull/44)), merged 18 Oct as `869f8b6`; QA pass (`4745b87`), ProductDesign approved (`4745b87`), Security pass (`4745b87`), seven CI checks green. Closes Sprint 1 feature development
- DEV-6 SEC-5 follow-ups ([#45](https://github.com/rojandhimal/onetickets/pull/45)), merged 18 Oct as `8655fc8`; QA pass (`f3ed17f`), Security pass (`f3ed17f`), 12 CI checks green. Cloudflare IPv6 ALB ingress added and Free rate-limit counter documented
- DEV-4 Docker API/web image builds in PR CI ([#42](https://github.com/rojandhimal/onetickets/pull/42)), merged 17 Oct at `b839748`; Security and DevOps passed `532c207`, QA-3 post-merge pass completed at `532c207`, seven checks green
- SEC-5 Cloudflare edge protection ([#39](https://github.com/rojandhimal/onetickets/pull/39)), merged 17 Oct at `2c05228`; [QA pass](https://github.com/rojandhimal/onetickets/pull/39#issuecomment-6214319585) and Security pass at `2a21efc`, ten checks green. Written infrastructure only; owner token/DNS steps updated, Free plan retained, Pro not authorised
- SEC-20 part 1 ([#41](https://github.com/rojandhimal/onetickets/pull/41)), merged 17 Oct at `bb50123`; [QA pass](https://github.com/rojandhimal/onetickets/pull/41#issuecomment-6219658433) and Security pass at `3c69b6f`, five checks green. Empty contact email stays empty; required-email UI/API work remains under part 2
- S1-4 Details and S1-2 offline-ticket/publish follow-ups ([#35](https://github.com/rojandhimal/onetickets/pull/35)), merged 17 Oct at `af4662f`; [final QA](https://github.com/rojandhimal/onetickets/pull/35#issuecomment-6219787424), [Design pass](https://github.com/rojandhimal/onetickets/pull/35#issuecomment-6219786496) and Security pass at `16103ea`. S1-2's row 1.6 follow-up is closed; integrated Sprint 1 acceptance remains pending
- PM contact-email decision and merge sync ([#40](https://github.com/rojandhimal/onetickets/pull/40)), merged 17 Oct
- BE-1 organisation names stored as plain text, existing ones cleaned by migration 0007 ([PR #34](https://github.com/rojandhimal/onetickets/pull/34)), merged 16 Oct at `d8bebfe`. QA and Security passed `c5acdb3`
- QA-2 flaky publish e2e fixed: the test waits for the venue autosave, and CI uploads traces and the api log on failure ([PR #38](https://github.com/rojandhimal/onetickets/pull/38)), merged 16 Oct at `2eac3d6`. Security passed `0012d4a`. QA wrote it, so FrontendDev does the independent review after merge
- SEC-19 search_path rule exempts built-in-only invoker functions ([PR #37](https://github.com/rojandhimal/onetickets/pull/37)), merged 16 Oct at `7a1bba9`. QA passed `e585e44`
- PM project sync with QA's #32 notes ([PR #36](https://github.com/rojandhimal/onetickets/pull/36)), merged 16 Oct at `8c1ffae`
- SEC-18 security docs: migrations scope, sign-out device data, ADR 0018 link rule, log retention ([PR #33](https://github.com/rojandhimal/onetickets/pull/33)), merged 16 Oct at `d309ce5`. [QA pass](https://github.com/rojandhimal/onetickets/pull/33#issuecomment-6209423168) at `59e0f0f`; one wording follow-up (SEC-19)
- PM two-way project sync and the independent-review rule ([PR #32](https://github.com/rojandhimal/onetickets/pull/32)), merged 16 Oct at `5e6bad1`. [QA pass](https://github.com/rojandhimal/onetickets/pull/32#issuecomment-6209417345) at `67a6faf`; its four notes are handled in the next sync PR
- S1-2 free ticket types in the wizard: name, capacity ±5, max per order, sales windows in the event's time zone, several types ([PR #31](https://github.com/rojandhimal/onetickets/pull/31)), merged 16 Oct. CI green on `064b2b9`; independent post-merge reviews completed; the offline follow-up shipped in #35
- BE-1 public cache headers and revalidation of every web task ([PR #25](https://github.com/rojandhimal/onetickets/pull/25)), merged 16 Oct at `70747fc`; reviewed head `26d788e`, QA and Security pass, all five checks green
- BE-1 / QA 3.2 revalidation infra ([PR #26](https://github.com/rojandhimal/onetickets/pull/26)), merged 16 Oct at `3191149`; reviewed head `b35323c`, QA and Security evidence above, all nine checks green. Infra is written only; AWS remains unapplied
- PM Sprint 1 handoff and review-evidence audit ([PR #28](https://github.com/rojandhimal/onetickets/pull/28)), merged 16 Oct at `4946cc0`; reviewed head `2cf0a7a`, [QA pass](https://github.com/rojandhimal/onetickets/pull/28#issuecomment-6206645290), all five checks green
- QA-1 Checklist reconciliation ([PR #29](https://github.com/rojandhimal/onetickets/pull/29)), merged 16 Oct at `8494333` from reviewed head `21c018c`: [QA pass](https://github.com/rojandhimal/onetickets/pull/29#issuecomment-6206529981), [Security pass](https://github.com/rojandhimal/onetickets/pull/29#issuecomment-6206530909), all five checks green. Rows 1.3, 3.2 and 4.3 match the settled decisions, and 4.4 explicitly checks starter About. All 43 statuses and staging deferrals remain unchanged; this closes QA-1, not Sprint 1 acceptance
- S1-3 public event page with share image, enforced nonce CSP (ADR 0018), A$53.35 money format and `/internal/revalidate` ([PR #23](https://github.com/rojandhimal/onetickets/pull/23)), merged 16 Oct
- Security migration review rule in AGENTS.md and role briefs, plus `project/` sync ([PR #24](https://github.com/rojandhimal/onetickets/pull/24)), merged 16 Oct
- S1-1 create-event wizard with autosave, venue lookup and publish ([PR #17](https://github.com/rojandhimal/onetickets/pull/17)), merged 15 Oct
- BE-1 one "from" price rule for cards, page and filter, and the A$10,000 price cap ([PR #22](https://github.com/rojandhimal/onetickets/pull/22)), merged 15 Oct. Security reviewed it after merge: pass
- SEC-10 cap: MAGIC_LINK_HOURLY_CAP setting and its alarm ([PR #21](https://github.com/rojandhimal/onetickets/pull/21)), merged 15 Oct. Turnstile on sign-in stays open under SEC-10
- Agent setup for any AI tool: AGENTS.md, role briefs in agents/, project files in project/ ([PR #20](https://github.com/rojandhimal/onetickets/pull/20)), merged 15 Oct. Sync both ways with `node scripts/sync-project-files.mjs`
- S1 api: events, free ticket types, banners, venue lookup, public page and browse ([PR #16](https://github.com/rojandhimal/onetickets/pull/16)), merged 15 Oct
- DEV-3 migrations run as a non-superuser owner in CI, compose and e2e ([PR #19](https://github.com/rojandhimal/onetickets/pull/19)), merged 15 Oct. Compose uses a new Postgres volume, so local databases start empty
- Sprint 0 closed 15 Oct. Last fix: web Docker image builds shared first ([PR #18](https://github.com/rojandhimal/onetickets/pull/18), QA), merged 15 Oct. Also merged 10 Oct: #12 shared auth types, #13 e2e CSP guard, #14 api logs and Sentry with PII masked, #15 infra Sentry and log settings
- DES-6 Sprint 7 to 9 designs (canvas v26): [handoff-s7.md](/project/design/handoff-s7.md), [handoff-s8-s9.md](/project/design/handoff-s8-s9.md). Defaults accepted by PM: payouts visible to Owner and Finance only; payout dates skip NSW/VIC public holidays; admin actions need a reason; releasing a held payout needs a second admin; Companion Card on by default; waiting room locked on at 1,000+ tickets; per-buyer limit across email, card and device
- S0-5 Error tracking on the web app, with Sentry scrubbing and a hardened /csp-report ([PR #9](https://github.com/rojandhimal/onetickets/pull/9)), merged 9 Oct
- Repo documentation: README, docs/, CONTRIBUTING, PR template, ADR index ([PR #8](https://github.com/rojandhimal/onetickets/pull/8)), merged 9 Oct
- S0-3 Sign-in API: magic link, Google behind config, sessions, TOTP MFA with recovery codes, rate limits and send cap ([PR #10](https://github.com/rojandhimal/onetickets/pull/10)), merged 9 Oct
- Security threat model and checklist in docs/security ([PR #7](https://github.com/rojandhimal/onetickets/pull/7)), merged 9 Oct
- DEV-1 One-command local stack ([PR #11](https://github.com/rojandhimal/onetickets/pull/11)), merged 9 Oct. `docker compose up --build`, site on :3000, test inbox on :8025
- S0-1 CI security gates ([PR #3](https://github.com/rojandhimal/onetickets/pull/3)), merged 9 Oct
- QA browser and accessibility tests ([PR #5](https://github.com/rojandhimal/onetickets/pull/5)), merged 9 Oct
- S0-3 Sign-up and organiser home, web side ([PR #2](https://github.com/rojandhimal/onetickets/pull/2)), merged 9 Oct. The auth API landed in #10; Sprint 0 acceptance closed the story
- S0-4 Organisations, roles and row-level security ([PR #6](https://github.com/rojandhimal/onetickets/pull/6)), merged 9 Oct
- S0-2 Environments in Terraform and deploy pipeline ([PR #4](https://github.com/rojandhimal/onetickets/pull/4)), merged 9 Oct. Not applied; staging deferred
- Product and business plan
- Investor pitch deck
- Human-centred design (personas, launch gate metrics)
- System architecture
- Savings vs printed tickets
- MVP sprint backlog (11 sprints)
- Accessibility audit of the design (24 issues found), fixes applied to the canvas
- Discovery interview guide ([discovery-interview-guide.md](/project/research/discovery-interview-guide.md)), assumes A$80 organiser and A$50 attendee incentives
- Sign-up and empty organiser home screens (canvas 0a, 0b), handoff in [handoff-s0.md](/project/design/handoff-s0.md)
- DES-1 Sprint 1 designs for S1-1 to S1-5 (canvas v17)
- DES-2 Sprint 2 designs S2-1, S2-2, S2-4 (canvas v18, [handoff-s2.md](/project/design/handoff-s2.md))
- DES-3 Sprint 3 scanner and Sprint 4 paid checkout designs (canvas v20, handoff-s3.md, handoff-s4.md), including SEC-1 and ARCH-1
- DES-5 UX copy for Sprints 0 to 2 ([copy-s0-s2.md](/project/design/copy-s0-s2.md)), canvas v23. ProductDesign resumed at tegs's request; next are the remaining S1 PR reviews and later demo feedback
- DES-4 Sprint 5 and 6 designs (canvas v22, handoff-s5-s6.md)
- S0-1 Monorepo and CI ([PR #1](https://github.com/rojandhimal/onetickets/pull/1)), merged by tegs 9 Oct
- [Usability test plan](/project/research/usability-test-plan-s1-s2.md) for Sprint 1 and 2 flows, sessions 9 to 12 Nov
- Research [recruitment pack](/project/research/recruitment-pack.md) and [notes template](/project/research/session-notes-template.md)
- Architecture review: 2 blocking and about 6 smaller fixes found ([review](https://claude.ai/code/artifact/01a2857b-b93c-4784-bffa-af9f6962663f))

## Pre-sprint readiness checklist (must be true by Fri 30 Oct)

- [x] Sign-up and empty organiser home screens agreed (Definition of Ready for S0-3)
- [x] Accessibility fixes applied to the design canvas
- [x] Discovery interview guide written (8 organisers, 6 attendees run during Sprint 0)
- [x] Decision: hired engineers build, starting 2 Nov (tegs, 8 Oct)
- [x] Builders in place: BackendDev and FrontendDev Claude threads (tegs, 8 Oct)
- [x] All Sprint 0 stories meet Definition of Ready
- [x] Security checklist ([checklist.md](/docs/security/checklist.md)) added to the Definition of Done: auth, roles, payments and QR stories must pass it
- [ ] Local Docker stack running on tegs's machine (DevOps). AWS, domain and Google OAuth deferred until staging

## Risks and blockers

| #   | Risk                                                                                                              | Impact                                          | Owner        | Action                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Claude dev threads need human review and merges on GitHub                                                         | Every sprint                                    | tegs         | Review PRs each sprint                                                                                                                                      |
| R2  | Staging deferred: demos to real organisers need a public link and real email                                      | Sprint 0 and 1 demos, S0-2                      | DevOps, tegs | DevOps proposing a temporary tunnel from tegs's machine; set up staging before paid tickets (Sprint 4) at the latest                                        |
| R4  | Stripe may limit how long Australian payouts can be held until after an event                                     | S7-1 post-event payouts, S4 design              | tegs         | Ask Stripe before Sprint 4 (18 Jan)                                                                                                                         |
| R5  | GST treatment of the processing fee unconfirmed                                                                   | S4-2 pricing, S5-1 invoices                     | tegs         | Ask the accountant before Sprint 4 (18 Jan)                                                                                                                 |
| R6  | QR ticket signing                                                                                                 | S2-3                                            | BackendDev   | Closed 9 Oct: AWS KMS in Sydney supports Ed25519 (DevOps). Signer behind an interface, local key in dev and CI                                              |
| R7  | AWS cost                                                                                                          | Budget                                          | DevOps       | Scaled down 9 Oct: dev account removed, staging minimal and off out of hours. About US$375-380/month (staging US$45-50, production US$330), alert at US$450 |
| R3  | No founding organisers lined up yet for sprint demos                                                              | Demo rule and launch gate                       | tegs         | Recruit 2 to 3 before 13 Nov                                                                                                                                |
| R8  | Two PM agents active at once (this Claude thread and a PM session in another tool, seen on #35 and #38 on 16 Oct) | Duplicate or conflicting asks to roles and tegs | tegs, PM     | Run one PM at a time. Whichever PM is active reads the repo board first; the Claude PM syncs project/ through PRs so other tools see its decisions          |

## Decisions log

| Date       | Decision                                                                                                                                                                                                                               | By                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 2026-10-08 | Light Agile: 2-week sprints, Kanban, demo to real organisers each sprint                                                                                                                                                               | tegs                        |
| 2026-10-08 | Free tickets and QR check-in ship before paid checkout                                                                                                                                                                                 | tegs (sprint backlog)       |
| 2026-10-08 | Hired engineers build the MVP; Sprint 0 starts 2 Nov as planned                                                                                                                                                                        | tegs                        |
| 2026-10-08 | Superseded hiring: Claude BackendDev and FrontendDev threads build, orchestrated by PM; Sprint 0 starts now                                                                                                                            | tegs                        |
| 2026-10-08 | Added QA, DevOps and Security reviewer threads                                                                                                                                                                                         | tegs                        |
| 2026-10-08 | Added ProductDesign thread; it owns the design canvas                                                                                                                                                                                  | tegs                        |
| 2026-10-08 | Sign-in asks email only; new accounts give organiser name after the magic link (no account enumeration)                                                                                                                                | PM                          |
| 2026-10-09 | Scale down dev and staging                                                                                                                                                                                                             | tegs                        |
| 2026-10-09 | Every PR updates its docs; every thread keeps a progress log ([working agreement](/project/pm/working-agreement.md))                                                                                                                   | tegs, PM                    |
| 2026-10-09 | Run locally with Docker for now; staging and AWS set up later                                                                                                                                                                          | tegs                        |
| 2026-10-09 | No LocalStack (non-commercial free tier, no RDS/ECS, SES v1 only); local dev uses docker compose Postgres, local mail and a local signing key. Dev AWS account dropped                                                                 | DevOps, PM                  |
| 2026-10-08 | PM thread owns this board and runs a weekly check-in                                                                                                                                                                                   | tegs                        |
| 2026-10-10 | Log retention 30 days staging, 90 days production                                                                                                                                                                                      | PM, Security                |
| 2026-10-10 | Rolling sprints: once a sprint is done and QA has accepted it, the next one starts right away instead of waiting for the planned date                                                                                                  | tegs                        |
| 2026-10-09 | AWS Agent Toolkit: skip until AWS accounts exist, then read-only on tegs's machine only                                                                                                                                                | DevOps, PM                  |
| 2026-10-09 | ADRs live in docs/adr/NNNN-title.md, numbered by the index in #8: 0001 to 0003 FrontendDev, 0004 BackendDev RLS, 0005 to 0014 backfilled, 0015 BackendDev sign-in                                                                      | PM, Repo documentation      |
| 2026-10-15 | Sprint 0 closed; QA accepted once #18 merged                                                                                                                                                                                           | QA, PM                      |
| 2026-10-15 | Agent setup is provider-independent: AGENTS.md, role briefs in agents/, and project files copied into project/ in the repo, so any AI tool can take over a role                                                                        | tegs, PM                    |
| 2026-10-15 | "From A$x" price uses the cheapest ticket type on sale, falling back to all types when none is on sale                                                                                                                                 | PM, QA                      |
| 2026-10-16 | Security reviews every PR with a database migration, and nothing joins the merge queue until all its reviewers have passed it (#22 merged before Security saw it)                                                                      | Security, PM                |
| 2026-10-16 | Event-page HTML stays private, no-store (ADR 0018); 60 s Next data cache, public API Cache-Control and /internal/revalidate fan-out to every web task cover QA 3.2                                                                     | PM, Security, QA            |
| 2026-10-16 | project/ in the repo and the Claude shared folder sync both ways (scripts/sync-project-files.mjs). Agents in other tools edit project/ through PRs; Claude threads keep using the shared folder                                        | tegs, PM                    |
| 2026-10-16 | Each review comes from that role's own agent session, not the author's subagents. #31's in-tool reviews are followed by QA and ProductDesign after merge                                                                               | PM                          |
| 2026-10-16 | Template About guidance in S1-4 is placeholder prompts, not prefilled text, so nothing unedited is published. QA checklist row 4.4 follows; the three cancellation labels are final                                                    | ProductDesign, PM           |
| 2026-10-16 | Staging API host is `api-staging.<domain>` (Cloudflare Free's edge certificate covers one level). SEC-5 ships on Cloudflare Free; Pro stays tegs's call                                                                                | DevOps, PM                  |
| 2026-10-16 | Attendee contact email: prefilled with the signed-in user's own email, visible and editable, and shown on the review step. There's no silent fallback, and publishing needs a contact email so replies to booking emails work (SEC-20) | ProductDesign, Security, PM |
