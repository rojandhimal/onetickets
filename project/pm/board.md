# OneTickets sprint board

Owner: PM thread ([PM](https://claude.ai/code/project/chan_01VQueTZ8BaEA4xeZ64T5fef?thread=cmsg_01VQueTZ8BaEA4xeZ64T5fefNqxFMiFUjcXL1ZifQpfAfY)). Source plan: [OneTickets MVP Sprint Backlog](https://claude.ai/code/artifact/908caae3-7868-4e89-9a10-4da3f5d376ae).
Last updated: 2026-10-10 03:05 UTC by PM. Other threads: send changes to PM rather than editing this file directly.

## Where we are

**Phase:** Sprint 0 closed 15 Oct (QA accepted once #18 merged). Sprint 1 is in progress. Rule from tegs: once a sprint is done and QA has accepted it, the next one starts straight away, without waiting for the planned date.
**Health:** 🟢 Ahead of plan, about a month early. The team lost 10 to 15 Oct to the plan's weekly usage limit. Sprint 1 PRs are open: S1 api (#16, Security passed, QA reviewing) and S1-1 wizard (#17, Security passed, ProductDesign asked for 3 must-fix items).
**Next milestone:** Sprint 1 closes when S1-1 to S1-5 merge and QA accepts. FrontendDev's S1-3 event page opens after #17 merges (one branch per thread). Demos to real organisers still depend on recruitment (RES-1); until then they run locally, or through a Cloudflare quick tunnel.

**Merge queue for tegs:** #17 once FrontendDev updates it from main and CI is green; #20 (agent setup for any AI tool) any time. Still to do: switch the repo's default branch to main.

## Sprint calendar

| Sprint                     | Planned dates (we move on early once QA accepts) | Goal                                                    | Status                                                               |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Pre-sprint                 | 8 Oct 2026                                       | Designs, research plan and decisions ready for Sprint 0 | 🟢 Done                                                              |
| 0 Foundations              | 8 Oct to 13 Nov (started early)                  | Repo, CI, environments, sign-up, roles, observability   | 🟢 Done 15 Oct ([QA acceptance](/project/qa/sprint-0-acceptance.md)) |
| 1 Publish and browse       | 16 to 27 Nov (started 10 Oct)                    | Event wizard, free ticket types, event page, browse     | 🟡 In progress                                                       |
| 2 Free tickets             | 30 Nov to 11 Dec                                 | Holds, free checkout, signed QR tickets, My tickets     | ⚪                                                                   |
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

## Board: Pre-sprint and Sprint 0

WIP limit: 2 cards in progress per builder.

Team (Claude threads, orchestrated by PM): BackendDev, FrontendDev, QA (test strategy, PR checks against acceptance criteria), DevOps (S0-2 Terraform and deploy pipeline, S0-5 infra alarms), Security reviewer (threat model, reviews of auth, RLS, PII), ProductDesign (owns the design canvas, handoff specs, Sprint 1 and 2 designs, research prep). tegs reviews and merges PRs. Repo documentation thread owns README and docs/. Everyone follows the [working agreement](/project/pm/working-agreement.md): each PR updates its docs, and each thread logs progress in pm/progress/. CI ownership: BackendDev owns the main CI workflow (QA adds the test harness to it), Security reviewer owns a separate security workflow, and DevOps owns the deploy workflows.

### Backlog

- Sprint 1 stories S1-2, S1-4, S1-5 (FrontendDev after S1-3). S1-3 event page is built and opens after #17 merges. Banner shown by default (showBanner flag) until tegs answers. Designs: canvas v23, [handoff-s1.md](/project/design/handoff-s1.md)
- ARCH-1 Blocking fix: Stripe charges use on_behalf_of so the organiser is the seller. Fold into S4-3 acceptance criteria before Sprint 4 planning ([architecture review](https://claude.ai/code/artifact/01a2857b-b93c-4784-bffa-af9f6962663f))
- ARCH-2 Blocking fix: waiting room must not show "sold out" while tickets are only held. Fold into S9-1 acceptance criteria
- SEC-1 Card-testing defences (Turnstile, rate limits per IP/email/card, Radar rules, decline-spike alert) move from S9-2 into S4-3
- SEC-2 S4-4: verify Stripe webhook signature on raw body and re-fetch the PaymentIntent before fulfilling
- SEC-3 S1-1/S1-3: sanitise event descriptions server-side, CSP on the event page
- SEC-4 S2-4: buyer ticket magic link is read-only, longer-lived, never logged or leaked in Referer
- SEC-7 Before S3-1/S6-6 reach real users: member invites become pending invites that need acceptance (BackendDev)
- SEC-8 Before S7 payouts: user-level security log (audit log is per organisation) that emails and logs recovery-code use and MFA reset. The MFA-enabled email already shipped in #10 (BackendDev)
- SEC-9 Before launch: scheduled cleanup of spent magic links (they hold emails, so Privacy Act retention), OAuth states, rate-limit rows and expired sessions (BackendDev)
- SEC-10 Before public launch: Cloudflare rate-limit rules on sign-in and /csp-report, plus Turnstile on sign-in; strip the incoming sentry-trace header at the edge for callers other than the web app; set MAGIC_LINK_HOURLY_CAP well above peak and alarm on its warning, since about 10 IPs can fill it (DevOps, FrontendDev)
- SEC-11 First staging deploy: QA checks that a spoofed X-Forwarded-For through the ALB still gets a 429 (QA)
- SEC-13 Later: forwarded "Ask the organiser" contact form with rate limits, no email disclosure, abuse reporting (Security shapes; FrontendDev, BackendDev)
- SEC-14 Must-have before Sprint 2 free checkout ships: enforce CSP across the whole site, not only /e/:slug, and review 'unsafe-inline' styles (ADR 0018) (FrontendDev, Security)
- DEV-2 After AWS accounts exist: AWS Agent Toolkit on tegs's machine with a read-only staging profile, for logs, costs and failed deploys. Not in the repo, not for the cloud threads (DevOps)
- SEC-15 Before launch: per-user rate limit on banner uploads and image processing concurrency 1, so one account can't starve the api (BackendDev)
- SEC-16 When the web sign-out control is built: call clearDeviceDrafts() (FrontendDev). The api side, Clear-Site-Data on sign-out, shipped in #16
- DES-7 Sprint 10 designs (canvas v29, [handoff-s10.md](/project/design/handoff-s10.md)). Defaults to confirm with tegs before Sprint 10: the founding offer waives only the OneTickets fee (card fees still apply); the data export link expires after 7 days. The Eventbrite and TryBooking export steps need checking before launch
- BE-1 From QA's #16 review, not blocking (BackendDev unless noted): Cache-Control and revalidation on public pages; one pricing function (before Sprint 4); server-side place resolution; a priceCents maximum (contract change, tell FrontendDev); handle live events that move into the past; a narrower public projection than the events_public row policy
- ARCH-4 Before launch: choose a real venue-lookup provider for /places (it uses a fixed venue list today). Needs a cost line and tegs's sign-off (BackendDev)
- SEC-5 Before Sprint 4: staging and production behind Cloudflare proxy, ALB limited to Cloudflare IP ranges (DevOps)
- SEC-6 Before production holds real data: Postgres sslmode=verify-full with RDS CA bundle (BackendDev, DevOps)
- (Source: [threat model](/docs/security/threat-model.md), 16 ranked risks. Fold into the backlog doc at each sprint's planning)
- ARCH-3 About 6 smaller fixes from the architecture review, to triage at Sprint 0 planning

### Ready

### In progress

- RES-1 Recruit 8 organisers and 6 attendees for discovery interviews: tegs (pack ready; fill in screener and video links)
- PRE-1 UI design canvas: waiting on tegs about the banner on the event page ([UI design](https://claude.ai/code/project/chan_01VQueTZ8BaEA4xeZ64T5fef?thread=cmsg_01VQueTZ8BaEA4xeZ64T5fefGvsnZc76CTuXRbT6sWV6aW))

### Review

- Agent setup for any AI tool: AGENTS.md, role briefs in agents/, project files in project/ ([PR #20](https://github.com/rojandhimal/onetickets/pull/20)) by PM. Ready to merge once CI is green.
- S1-1 create-event wizard with autosave, venue lookup and publish: [PR #17](https://github.com/rojandhimal/onetickets/pull/17) by FrontendDev. QA, Security and ProductDesign pass at 80636d9. Merges after #16: FrontendDev merges main in (trivial docs/adr/README.md and .gitignore conflicts) so CI e2e goes green. Starter About text moved to S1-4.

### Done

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
- S0-3 Sign-up and organiser home, web side ([PR #2](https://github.com/rojandhimal/onetickets/pull/2)), merged 9 Oct. Story stays open until the auth API lands
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
- DES-5 UX copy for Sprints 0 to 2 ([copy-s0-s2.md](/project/design/copy-s0-s2.md)), canvas v23. ProductDesign paused until 13 Nov demo feedback
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

| #   | Risk                                                                          | Impact                             | Owner        | Action                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------- | ---------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Claude dev threads need human review and merges on GitHub                     | Every sprint                       | tegs         | Review PRs each sprint                                                                                                                                      |
| R2  | Staging deferred: demos to real organisers need a public link and real email  | Sprint 0 and 1 demos, S0-2         | DevOps, tegs | DevOps proposing a temporary tunnel from tegs's machine; set up staging before paid tickets (Sprint 4) at the latest                                        |
| R4  | Stripe may limit how long Australian payouts can be held until after an event | S7-1 post-event payouts, S4 design | tegs         | Ask Stripe before Sprint 4 (18 Jan)                                                                                                                         |
| R5  | GST treatment of the processing fee unconfirmed                               | S4-2 pricing, S5-1 invoices        | tegs         | Ask the accountant before Sprint 4 (18 Jan)                                                                                                                 |
| R6  | QR ticket signing                                                             | S2-3                               | BackendDev   | Closed 9 Oct: AWS KMS in Sydney supports Ed25519 (DevOps). Signer behind an interface, local key in dev and CI                                              |
| R7  | AWS cost                                                                      | Budget                             | DevOps       | Scaled down 9 Oct: dev account removed, staging minimal and off out of hours. About US$375-380/month (staging US$45-50, production US$330), alert at US$450 |
| R3  | No founding organisers lined up yet for sprint demos                          | Demo rule and launch gate          | tegs         | Recruit 2 to 3 before 13 Nov                                                                                                                                |

## Decisions log

| Date       | Decision                                                                                                                                                               | By                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 2026-10-08 | Light Agile: 2-week sprints, Kanban, demo to real organisers each sprint                                                                                               | tegs                   |
| 2026-10-08 | Free tickets and QR check-in ship before paid checkout                                                                                                                 | tegs (sprint backlog)  |
| 2026-10-08 | Hired engineers build the MVP; Sprint 0 starts 2 Nov as planned                                                                                                        | tegs                   |
| 2026-10-08 | Superseded hiring: Claude BackendDev and FrontendDev threads build, orchestrated by PM; Sprint 0 starts now                                                            | tegs                   |
| 2026-10-08 | Added QA, DevOps and Security reviewer threads                                                                                                                         | tegs                   |
| 2026-10-08 | Added ProductDesign thread; it owns the design canvas                                                                                                                  | tegs                   |
| 2026-10-08 | Sign-in asks email only; new accounts give organiser name after the magic link (no account enumeration)                                                                | PM                     |
| 2026-10-09 | Scale down dev and staging                                                                                                                                             | tegs                   |
| 2026-10-09 | Every PR updates its docs; every thread keeps a progress log ([working agreement](/project/pm/working-agreement.md))                                                   | tegs, PM               |
| 2026-10-09 | Run locally with Docker for now; staging and AWS set up later                                                                                                          | tegs                   |
| 2026-10-09 | No LocalStack (non-commercial free tier, no RDS/ECS, SES v1 only); local dev uses docker compose Postgres, local mail and a local signing key. Dev AWS account dropped | DevOps, PM             |
| 2026-10-08 | PM thread owns this board and runs a weekly check-in                                                                                                                   | tegs                   |
| 2026-10-10 | Log retention 30 days staging, 90 days production                                                                                                                      | PM, Security           |
| 2026-10-10 | Rolling sprints: once a sprint is done and QA has accepted it, the next one starts right away instead of waiting for the planned date                                  | tegs                   |
| 2026-10-09 | AWS Agent Toolkit: skip until AWS accounts exist, then read-only on tegs's machine only                                                                                | DevOps, PM             |
| 2026-10-09 | ADRs live in docs/adr/NNNN-title.md, numbered by the index in #8: 0001 to 0003 FrontendDev, 0004 BackendDev RLS, 0005 to 0014 backfilled, 0015 BackendDev sign-in      | PM, Repo documentation |
| 2026-10-15 | Sprint 0 closed; QA accepted once #18 merged                                                                                                                           | QA, PM                 |
| 2026-10-15 | Agent setup is provider-independent: AGENTS.md, role briefs in agents/, and project files copied into project/ in the repo, so any AI tool can take over a role        | tegs, PM               |
