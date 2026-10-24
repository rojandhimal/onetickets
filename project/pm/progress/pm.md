# Progress: PM

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-23 (23:40 to 23:50 UTC, Claude)

- **Done:** tegs merged #62 as `f11ab57`, so S2-4a is done and the ticket screen meets Security's ADR 0020 condition. Merged main into #65 and recorded it. FrontendDev (Claude) is free, so I pointed it at DES-10, the only unassigned ready frontend item.
- **Then:** tegs merged #63 as `bcded67`, so DEV-7 is done. Dependency audit went red on `main` and every PR: new high advisories in `zod`, `body-parser` and `multer` (api dependencies). tegs's CI-fix thread already opened #67 with the fix, so I recorded it as SEC-22 (DevOps, Security and QA review). tegs merged #65 as `04e7da7`, but the main merge on GitHub kept main's older graph lines, so this sync restores #62, #63, S2-4a, DEV-7 and the role lines. Removed the stale DEV-6 backlog card (done in #45).
- **Then:** tegs merged #67 as `f380c8f`, so SEC-22 is done and Dependency audit is green again.
- **Next:** QA reviews this sync. FrontendDev claims DES-10. DevOps (free) can claim SEC-23, the `nodemailer` follow-up I added as ready.
- **Then:** tegs merged #63 as `bcded67`, so DEV-7 is done. Dependency audit went red on `main` and every PR: new high advisories in `zod`, `body-parser` and `multer` (api dependencies). Opened SEC-22 for DevOps, the free role, with Security and QA review. Removed the stale DEV-6 backlog card (done in #45).
- **Next:** DevOps lands SEC-22, then I merge main into #65 so it goes green. FrontendDev claims DES-10.
- **Blocked:** tegs's order API choice for S2-2 and the rest of S2-3.

## 2026-10-23 (19:50 UTC, Claude)

- **Done:** tegs merged #60 as `2787073`, so the agent assignment rule (D19) is live. Recorded the merge with QA's pass at `b4bc226`, QA's fail on #62 at `eebd9b7` (partial offline save). FrontendDev fixed it at `4d117c6`, and QA, Security and Design pass `d99df5f` and #63 (DEV-7): QA failed it at `10f6255` and passed the fix at `184d4f9`. Added DEV-7 and BE-6 (#64) to the board; their graph items come in their own PRs.
- **Next:** #62 (all 7 checks green) and #63 (Security's pass holds at `184d4f9`) are ready for tegs, and so is this sync, #65. Release claims idle for more than 5 days at each daily check.
- **Blocked:** tegs's order API choice for S2-2 and the rest of S2-3.

## 2026-10-23 (15:40 UTC, Claude)

- **Done:** Fixed QA's finding on #60: the graph now has S2-4a (`agent` claude, in review with #62) and a #62 PR node, using the same S2-4a line #62 adds, so the board and graph agree. Moved S2-4a to Review on the board.
- **Next:** QA re-checks #60 from `79e5a22`. Once tegs confirms "one task at a time" means per agent and role, #60 is ready for tegs.
- **Blocked:** tegs's order API choice for S2-2 and the rest of S2-3.

## 2026-10-23 (15:20 UTC, Claude)

- **Done:** tegs merged #58 and #61 after #56, so DEV-5 is done and S2-3's screen and signing are on main. Merged main into #60 again, and added tegs's agent assignment rule to it, because #60 needed a new review anyway. Every item gets `agent`, `claimed` and `active`. `state.mjs` gains `next`, `claim` and `release`, and the brief lists idle claims. The working agreement (section 5), AGENTS.md, agent briefs, graph README and board follow, and D19 records the rule. Gave FrontendDev S2-4a (#62) and DevOps DEV-7 (RDS bundle CI check) while the order API waits. Released S2-3 (now blocked on the order API choice), so BackendDev can take the S3 banner adapter (BE-6) under one task at a time.
- **Next:** QA re-checks #60, then tegs merges it. PM releases claims idle for more than 5 days at each daily check.
- **Blocked:** tegs's order API choice for S2-2 and the rest of S2-3.

## 2026-10-23 (15:00 UTC, Claude)

- **Done:** tegs merged #56 (S2-3 ticket screen) as `da8d689`. It carried the Next.js bump, so SEC-21 is done and #60 is now only the PM sync. Merged main into #60 and resolved the conflicts (package.json and the lockfile taken from main; graph role nodes). Asked BackendDev (#58) and DevOps (#61) to merge main the same way.
- **Next:** tegs's new rule: assign each board task to one agent provider, one task at a time, and PM releases claims that are idle for more than 5 days. It goes into a PR straight after this sync.
- **Blocked:** nothing.

## 2026-10-23 (06:40 UTC, Claude)

- **Done:** Four PRs passed every review they need with all checks green, and are with tegs in merge order: #60 (SEC-21, the critical Next.js fix) first, then #56 and #58 (S2-3 ticket screen and signing) and #61 (DEV-5). Recorded the verdicts in the graph, fixed QA checklist row 3.6 to match ADR 0011 (one key per environment, token carries the ticket id), and synced the role logs. Nothing merged overnight.
- **Next:** After #60 merges, restart the PM branch from main with this sync. The S2-2 order API choice (#58's reference build or #59) is still with tegs; ticket issuing and the email (row 3.7) wait on it.
- **Blocked:** tegs's merges and the order API choice.

## 2026-10-22 (19:10 UTC, Claude)

- **Done:** All Claude threads paused 14:22 to 19:00 on a usage limit. Meanwhile tegs merged #54 (SEC-6) and #57 (STATE-1), which carried #55 and #53. Recorded the merges in the state graph and on the board. The other tool opened draft #59 for S2-2, and it also builds the order API and a basic confirmation page, which #58 had claimed but not yet built. Moved S2-2-API to #59 so the work isn't done twice; #58 goes back to S2-3 signing on top of #59, and #56 builds the ticket stub on #59's confirmation page.
- **Next:** QA reviews #59. Claude Security checks #59's order ref (a bearer reference in the URL that returns name and email) against its S2-3 conditions. DevOps opens the DEV-5 PR now that #54 has merged.
- **Blocked:** nothing.

## 2026-10-22 (14:10 UTC, Claude)

- **Done:** tegs decided that agents in several tools keep working at once, towards one goal, each starting from the current state. Recorded it in the working agreement (section 4), AGENTS.md rule 3, agents/README.md and the decisions log. Claimed S2-3 for Claude BackendDev and FrontendDev, since the other tool's FrontendDev has S2-2. Put Claude DevOps's SEC-6 (#54) on the board. This sync carries the other PM's #53, so the two board PRs don't conflict.
- **Next:** Claude BackendDev and FrontendDev open draft PRs for S2-3. Nobody owned the S2-2 order API (create a free order from a hold), which S2-3 hangs off, so the Claude BackendDev builds it first in the same draft PR. #54 goes through Security, QA and BackendDev reviews. A separate thread is building the shared knowledge graph.
- **Blocked:** nothing.

## 2026-10-22 (PRs #50, #51, #52 merged to main; S2-2 started)

- **Done:** Verified `tegs` merged PR #50 (S2-1 free ticket holds and inventory as `e7303ba`), PR #51 (Sprint 2 checklist and board rollup as `31553aa`), and PR #52 (SEC-14 site-wide CSP as `7023181`). With site-wide CSP and holds on main, all architectural prerequisites for free checkout are met. Fast-forwarded local `main` to `origin/main` (`7023181`). Updated board and checklist to mark S2-1 and SEC-14 Done. Kicked off Story S2-2 (One-screen free checkout).
- **Next:** FrontendDev and ProductDesign implement S2-2 free checkout screen (`/e/:slug/tickets`), steppers, hold notice and heartbeat, attendee inputs, and order submission.
- **Blocked:** Staging checks remain deferred until AWS account and Google OAuth client setup.

## 2026-10-22 (02:05 UTC, Claude PM back)

- **Done:** Caught up on 17 to 22 Oct. While the Claude threads were offline, the other tool's team closed Sprint 1 (QA accepted 18 Oct) and merged #39, #42 to #52, including S1-5, SEC-20 part 2, S2-1 and SEC-14. Brought the shared folder up to date from main with the sync script. Claude FrontendDev had built a duplicate of #48, so it's on hold. Asked tegs which team runs from now on.
- **Next:** Act on tegs's choice. If it's the Claude team, Claude FrontendDev takes S2-2 from the latest main, and the Claude PM takes over the board after #53. Otherwise the Claude threads stay paused and the Claude PM only watches.
- **Blocked:** Two teams active at once (risk R8). Waiting on tegs.

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
