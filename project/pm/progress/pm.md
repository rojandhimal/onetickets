# Progress: PM

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-21 (PR #50 S2-1 passed QA and Security reviews, marked ready for tegs)

- **Done:** Verified PRs #46 (BE-1), #47 (Docs sign-in), #48 (SEC-20 part 2), and #49 (Sprint 1 acceptance rollup) were merged into `main` by tegs. Rebased `backend/s2-1-ticket-holds` onto latest `origin/main` at `fcc6142` and opened PR #50 for S2-1 (Free ticket holds and inventory). All 7 GitHub Actions CI checks passed green. Orchestrated independent reviews: Security passed at `fcc6142` (confirming RLS, ephemeral token hashing, sweeper safety, CSRF origin check); QA passed at `fcc6142` (confirming INV-1, INV-2, INV-3, INV-4, ARCH-2/INV-15, and checklist rows 1.1–1.5). Marked PR #50 ready for review and placed into the merge queue for tegs.
- **Next:** tegs merges PR #50. FrontendDev and Security start SEC-14 (site-wide enforced CSP, ADR 0018). FrontendDev starts S2-2 (one-screen free checkout).
- **Blocked:** Staging checks remain deferred until AWS account and Google OAuth client setup. No infrastructure applied.

## 2026-10-18 (Sprint 1 accepted, S1-5 and DEV-6 merged, PR #46 & #47 ready)

- **Done:** Verified S1-5 (#44, `869f8b6`) and DEV-6 (#45, `8655fc8`) merged by tegs, bringing all 5 Sprint 1 stories to `main`. QA completed the integrated Sprint 1 acceptance pass on `main` at `8655fc8` and wrote [project/qa/sprint-1-acceptance.md](/project/qa/sprint-1-acceptance.md) accepting Sprint 1 with staging deferrals carried forward. Reviewed and routed PR #46 (BE-1 catalogue hardening) and PR #47 (Docs local sign-in): both passed QA and Security reviews with all CI checks green, and both are marked ready for tegs. Updated the sprint board to mark Sprint 1 Done and open Sprint 2.
- **Next:** tegs merges PR #46 and PR #47. Team commences Sprint 2 (Free tickets: S2-1 ticket holds and orders, S2-2 free checkout, S2-3 signed offline QR tickets, S2-4 My tickets attendee portal) and SEC-20 part 2.
- **Blocked:** Staging checks remain deferred until AWS account and Google OAuth client setup.

## 2026-10-17 (merge reconciliation)

- **Done:** Verified #35/#40/#41 and #39/#42 merged, with latest main `b839748`. Reconciled the board and roadmap: S1-1 through S1-4 are merged, S1-2's offline follow-up shipped in #35, and S1-5 is next. Split SEC-20's shipped fallback removal from its remaining UI/publish requirement. Updated owner setup for the Cloudflare token, Terraform-managed proxied DNS and apply order. Recorded QA-3 because #42 has Security/DevOps passes and green checks but no explicit QA verdict in its comments/reviews at this audit. Preserved the unfinished local editor branch; BE-5 evaluates only its retry-hardening idea against main, without replacing shipped UI. DEV-6 carries the remaining edge-review notes. Local format/lint/typecheck, 208 unit tests, 110 integration tests, production build and 32 browser/axe/CSP tests pass against a separate test database; all 27 local documentation links resolve.
- **Next:** Separate QA and Security sessions review this PM PR; QA also completes QA-3. FrontendDev starts S1-5; BackendDev/FrontendDev coordinate SEC-20 part 2; DevOps continues SEC-6. QA accepts Sprint 1 only after S1-5 merges and the integrated journey passes. Record CI verification and final review verdicts in this PR.
- **Blocked:** Live-project copy-back waits for `/mnt/project-files` access; role logs remain owned by their respective sessions. Staging and organiser research still depend on owner setup and RES-1. No infrastructure was applied.

## 2026-10-16 (10:55 UTC, daily check)

- **Done:** tegs merged #32 and #33, both after QA passed them. No merge since then skipped a review. Routed S1-4 (#35): ProductDesign's About placeholder prompts and its three #31 fixes landed at `468cf23`, and QA's #31 offline ticket-edit finding rides #35 next. Carded QA-2 (flaky mobile publish e2e on main) and SEC-19 (search_path wording). Synced project files and opened [#36](https://github.com/rojandhimal/onetickets/pull/36), which also covers QA's four #32 notes. Most role threads stopped around 06:20 to 06:30 UTC, so I restarted FrontendDev, QA, Security, ProductDesign and DevOps on their next items.
- **Next:** QA on #34, QA-2 and #36. The offline fix on #35, then its re-reviews. DevOps starts SEC-5. S1-5 starts once #35 merges. Sprint 1 acceptance follows.
- **Blocked:** nothing. tegs: merge #36 once QA passes it.

## 2026-10-16 (06:00 UTC, back in the Claude PM thread)

- **Done:** Reviewed what landed while another tool ran PM, QA and FrontendDev: #23, #25, #26, #27 to #30 and S1-2 ([#31](https://github.com/rojandhimal/onetickets/pull/31)). Merged the repo's board, checklist and logs with the Claude threads' newer log entries in the shared folder, so neither side lost work. Replaced the one-way sync with `scripts/sync-project-files.mjs`, which syncs both ways and merges progress logs. Board and roadmap now show S1-2 merged and S1-4 next. Asked QA and ProductDesign to review #31 after merge, since its reviews came from the authoring tool's own subagents; AGENTS.md now says reviews come from a separate session per role.
- **Next:** FrontendDev starts S1-4, then S1-5. BackendDev takes the organisation-name cleanup from BE-1, DevOps SEC-5, Security the docs/security PR (SEC-18). QA runs Sprint 1 acceptance once S1-4 and S1-5 merge.
- **Blocked:** nothing for tegs right now beyond the open owner-setup items (branch protection, RES-1 recruitment).

## 2026-10-16 (1:55 pm AEDT merge handoff)

- **Done:** Confirmed [#25](https://github.com/rojandhimal/onetickets/pull/25) merged as `70747fc` and [#26](https://github.com/rojandhimal/onetickets/pull/26) as `3191149` at 1:52 pm AEDT, after PM completed their ready transitions. [#28](https://github.com/rojandhimal/onetickets/pull/28) also merged as `4946cc0`. Cleared the old queue, moved all three to Done, retained their reviewed-head evidence, and refreshed the roadmap. Corrected the web cache documentation to match the merged per-task fan-out and fallback behaviour. Local format/lint/typecheck, 187 unit tests, 106 Postgres integration tests, build and 24 browser/axe/CSP tests pass on the merged implementation. Historical role logs and QA evidence remain intact; AWS is still unapplied.
- **Next:** FrontendDev starts S1-2 from latest main, then S1-4 and S1-5. BackendDev and DevOps refresh their own logs and continue remaining BE-1 / SEC-5 / SEC-6 work as applicable. QA accepts Sprint 1 only after all required stories merge and the integrated publish-and-browse pass succeeds; PM completes each ready transition when required reviews and CI pass.
- **Blocked:** S1-2 has no pending merge dependency. RES-1 recruitment and owner staging setup still block real-organiser/staging evidence; live-project copy-back waits for the shared folder to be available.

## 2026-10-16 (1:20 pm AEDT merge follow-up)

- **Done:** [QA-1 #29](https://github.com/rojandhimal/onetickets/pull/29) merged at 1:19 pm AEDT as `8494333`, with QA, Security and all five CI/security checks green at `21c018c`. Moved QA-1 to Done on the board and brought main into the PM branch. [#28](https://github.com/rojandhimal/onetickets/pull/28) also passed [final QA](https://github.com/rojandhimal/onetickets/pull/28#issuecomment-6206555424) and all five checks at `99bb486`; it temporarily returns to draft while the follow-up records #29's merge. Checklist reconciliation is complete; Sprint 1 acceptance remains pending.
- **Next:** PM rechecks the updated #28 head and marks it ready after QA and CI pass; tegs merges. FrontendDev starts S1-2, then S1-4 and S1-5. BackendDev and DevOps still mark #25/#26 ready; QA runs acceptance after all required stories and revalidation changes merge.
- **Blocked:** Owner merges remain with tegs; RES-1 recruitment and staging owner setup still block real organiser/staging evidence. Live-project copy-back waits for that folder to be available.

## 2026-10-16 (1:15 pm AEDT follow-up)

- **Done:** Verified all five CI/security checks on [#28](https://github.com/rojandhimal/onetickets/pull/28) at `deaaaa8` and recorded its [independent QA pass](https://github.com/rojandhimal/onetickets/pull/28#issuecomment-6206461648). Corrected the #26 README-only summary to include ALB defence in depth. Coordinated QA-1 in isolated branch `codex/qa-s1-checklist-handoff`; [PR #29](https://github.com/rojandhimal/onetickets/pull/29) at `21c018c` has [independent QA](https://github.com/rojandhimal/onetickets/pull/29#issuecomment-6206529981) and [Security](https://github.com/rojandhimal/onetickets/pull/29#issuecomment-6206530909) passes. Its checklist changes preserve every status and staging deferral, with no Sprint 1 acceptance claim. Local lint/typecheck, 181 unit tests and 101 integration tests pass again; QA-1's formatting, links and whitespace checks pass.
- **Next:** tegs reviews/merges #28 and #29 after their final-head review and CI gates pass; PM marks them ready when those conditions hold. BackendDev and DevOps still mark #25/#26 ready. FrontendDev starts S1-2, then S1-4 and S1-5; QA runs integrated acceptance only after the required stories and revalidation changes merge.
- **Blocked:** Owner merges remain with tegs. Real organiser demos need RES-1 recruitment; staging checks need the owner setup. The live Claude project folder remains unavailable here, so its copy-back waits for access; repo updates are in the PRs.

## 2026-10-16 (PM handoff)

- **Done:** Opened draft [PR #28](https://github.com/rojandhimal/onetickets/pull/28) after auditing all role logs and PRs #23–#27. Refreshed the board, roadmap and owner setup; ordered the remaining S1 handoff and carded the QA checklist/review follow-ups. Verified #25 at `26d788e` and #26 at `b35323c` have green CI and required review evidence. Posted handoffs on [#23](https://github.com/rojandhimal/onetickets/pull/23#issuecomment-6206352332), [#25](https://github.com/rojandhimal/onetickets/pull/25#issuecomment-6206351020) and [#26](https://github.com/rojandhimal/onetickets/pull/26#issuecomment-6206351603), and [requested QA on #28](https://github.com/rojandhimal/onetickets/pull/28#issuecomment-6206350310). Local format/lint/typecheck, 181 unit tests, 101 Postgres integration tests, build and 24 browser/axe/CSP tests pass.
- **Next:** Follow up QA and CI on #28; recheck heads and reviews before changing the merge queue. BackendDev and DevOps refresh their own logs and mark #25/#26 ready for tegs; FrontendDev picks up S1-2, then S1-4 and S1-5. QA reconciles the checklist with settled privacy/caching decisions before Sprint 1 acceptance; PM rolls the sprint only after QA accepts.
- **Blocked:** #28 awaits QA review; tegs merges #25/#26 once ready. Real organiser demos need RES-1 recruitment, and staging checks need the owner setup. The live Claude project folder is unavailable here, so the repo is updated directly; PM must copy this handoff back when that folder is available.
