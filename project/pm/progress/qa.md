# Progress: qa

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-24 (Claude)

- **Done:**
  - [#66](https://github.com/rojandhimal/onetickets/pull/66) DES-10 **passes** at c695a7c. Verdict posted after tegs merged it (e0f33b1). Web tests 193/193. The held and sold states follow the handoff. "All tickets taken" has no count because the public DTO has no capacity.
  - Follow-up for the api: soldOut covers on-sale types only, while spotsLeft sums every type. A hold-full on-sale type plus an off-sale type shows "N spots left".
  - [#68](https://github.com/rojandhimal/onetickets/pull/68) PM sync was merged before review. Main's graph is restored and valid (121 nodes). Nits: DES-10 and the #66 node, and meta.main.
  - [#69](https://github.com/rojandhimal/onetickets/pull/69) PM sync **passes** at bc2bb16 (123 nodes, valid). Nits: record qa pass@c695a7c on #66; add a card for the soldOut follow-up.
- **Next:** re-check #59 when fixes land; review ticket issuing (rows 3.6 and 3.7).
- **Blocked:** nothing.

## 2026-10-23 (Claude)

- **Done:** Re-checked [#60](https://github.com/rojandhimal/onetickets/pull/60) for `f227cd1..e862049`: pass.
  - SEC-21 bumps Next.js to 16.4.2. The lockfile moves only next and @next/*, and the dependency audit is now green.
  - The graph is valid at 110 nodes.
  - The pass depends on lint/unit and e2e going green on e862049.
  - Nit: the #56 pr node lacks the QA fail.
  - #60 re-checked at cc62030 (main merged in, project/ only): still a pass. Nit: row 3.4 still has the old brightness copy.
  - #60 at 79e5a22 (D19 agent assignment, one task at a time) needs one fix.
    - The tool and docs pass: I drove next, claim, release, the stale list and the validate guard on a scratch graph, and the 14 tests pass.
    - The fix: S2-4a is on the board as [claude] but missing from graph.jsonl.
    - Asked PM to get tegs's confirmation that "one at a time" means per agent and role.
    - f0c8c29 (S2-3 released while it waits on the order API) is fine. The S2-4a fix is still open.
    - Passes at b4bc226, the merged head: S2-4a is now in the graph.
  - [#62](https://github.com/rojandhimal/onetickets/pull/62) S2-4a remove-from-device and expiry **fails** at 7d8f61d.
    - What works: the remove flow, focus, expiry in both the page and the worker, and unit tests (189/189).
    - Blocker: a partial offline save keeps the order on the device with no Remove button. The probe is in qa/scripts/qa62.test.tsx.
    - Blocker: graph.jsonl conflicts with main.
    - Copy: "We couldn't remove your tickets." doesn't match the code.
    - eebd9b7: the copy is fixed. The partial-save blocker is still open, and graph.jsonl conflicts with main again.
    - d99df5f: **passes**, as long as E2E goes green. hasSavedOrder fixes the partial-save case (the probe passes), it merges cleanly into main, and web tests are 192/192.
  - [#65](https://github.com/rojandhimal/onetickets/pull/65) PM sync **passes** at 23d630b: the state check is valid, tests are 14/14 and it merges cleanly. Nits: #62 qa node, stale qa role node.
    - Passes at 0a18399 with the nits fixed. E2E on #62 at d99df5f is green, so the #62 pass has no remaining condition.
    - 28a4805: the content is correct (#62 merged as f11ab57, S2-4a done), but it conflicts with main in graph.jsonl after #63 merged (bcded67). It needs main merged in and #63 recorded as merged.
  - [#63](https://github.com/rojandhimal/onetickets/pull/63) DEV-7 CA bundle image check **fails** at 10f6255.
    - Without pipefail, two empty hashes compare equal, so a tf path naming a file missing from both certs and the image passes.
    - Fix: pipefail plus test -n on both hashes.
    - Passes at 184d4f9: pipefail, exactly one sslrootcert and test -n are in, and the empty-hash case now fails. This depends on the api image job.
  - Re-checked [#56](https://github.com/rojandhimal/onetickets/pull/56) for `c3c54ac..8dfed02`: pass.
    - A 404 with a key shows the bad-link message and drops the saved copy.
    - With no key, the page makes one request, so online it shows nothing and the saved copy appears only with no signal.
    - main is merged in and the ADR is now 0020.
    - Web unit tests pass 185/185 with my probes. The pass depends on CI going green.
  - #61 re-checked at d2e620f (the ported Next bump, identical to #60's) and at 302d454 (the cache rule skips % and ..): still a pass. Also at 28193ce (main merged in; infra unchanged).
  - [#58](https://github.com/rojandhimal/onetickets/pull/58) S2-3 codec and signer pass at eda1451.
    - Independent probes: verification needs the context, any one-byte flip fails, a foreign key fails, padding bits are rejected and production keys are refused. The probe is in qa/scripts/qa58.test.ts.
    - Issuing tickets and row 3.7 are still to come.
    - Checklist row 3.6 wording is out of date.
    - Re-checked at 1b51537 (docs only: neutral order-API wording and a progress entry): still a pass.
    - Re-checked at 63f304c (main merged in after #56; only #58's 11 files differ from main): still a pass.
- **Next:** Re-check #59 when its fixes are pushed. Review #58's issuing follow-up.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 2026-10-22 (Claude)

- **Done:** Reviewed [#55](https://github.com/rojandhimal/onetickets/pull/55) (board sync, working agreement section 4) at 012b235: pass. The rules are consistent across AGENTS.md, agents/README and the working agreement, the board matches main, and there's no personal data or secrets.
  - #55 re-checked at 4243eec: still a pass.
  - [#54](https://github.com/rojandhimal/onetickets/pull/54#issuecomment-6342929516) SEC-6 passes at 72feb4c. The bundle is byte-identical to AWS's ap-southeast-2 file and ships at /app/certs. The deployed node-postgres refuses a wrong CA and a wrong hostname under verify-full. Optional note: add a CI guard on url_params.
  - #55 re-checked at 8d001c9: still a pass.
  - [#57](https://github.com/rojandhimal/onetickets/pull/57) STATE-1 passes at 60eb483. The brief works, check and lint fail on 6 kinds of graph breakage, the sync round-trips, and the nodes match main and GitHub. Note: record the graph in .sync-state.json, otherwise the first both-sides change conflicts on the whole file.
  - #55 re-checked at cf466f6: still a pass.
  - [#60](https://github.com/rojandhimal/onetickets/pull/60#issuecomment-6348982153) passes. Nit: `#55.head` in the graph is stale.
  - [#59](https://github.com/rojandhimal/onetickets/pull/59#issuecomment-6349089186) S2-2 free checkout **fails** at 3c2ff43. Checks are green and INV-5 holds: 10 parallel posts with one key made 1 order, and 4 keys racing one hold made 1 order plus three 410s. Two blockers:
    - An anonymous `GET /public/orders/:ref` returns the buyer's email and name. The ref is a 40-bit value in the URL with no rate limit (P.3).
    - The permissive `orders_public_select` and `tickets_public_select` policies let org B, or a session with no organisation, read org A's orders and emails.
    - The probe is in qa/scripts/qa59.int.test.ts.
  - [#61](https://github.com/rojandhimal/onetickets/pull/61#issuecomment-6349201447) DEV-5 banner storage (infra) passes at 3f8f2d9.
    - The switch defaults to local, the narrower IAM breaks nothing, and the lifecycle only affects banners/.
    - The Next rewrite passes the API's immutable Cache-Control through with no Set-Cookie, so Cloudflare can cache banners.
    - Notes: the edge TTL of a year outlives the 30-day retention of deleted banners, and the cache rule is case-sensitive.
    - The dependency audit is red on main too, from the next@16.4.0 advisories.
    - Re-checked at fc6758a and still a pass. The edge TTL is now 30 days and the path match uses lower(). Optional: a 404 status TTL.
    - 5733cda passes too: banner errors (400-599) are never cached at the edge. This depends on CI's edge validate.
  - [#56](https://github.com/rojandhimal/onetickets/pull/56#issuecomment-6349318895) S2-3 ticket screen **fails** at c3c54ac.
    - Rows 3.1 to 3.5 pass: unit tests 178/178, and the ticket e2e passes 6/6 at 375 px and 1280 px.
    - Blocker: the saved offline copy is shown after a server 404 with a key, which covers revoked and expired keys.
    - Blocker: the saved copy is shown online with no key and no fetch, so a shared phone opening the order from history sees the name, email and QR.
    - Blocker: docs/adr/README.md conflicts with main, ADR 0019 is already taken (it needs to be 0020), and no CI has run at that head.
    - The probe is in qa/scripts/qa56.test.tsx.
- **Next:** The Claude team's S2-3 PRs, checked against the S2-3 rows in qa/sprint-2-checklist.md and the handoff-s2.md fill-ins.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 21 Oct 2026

- **Done:**
  - Reviewed PR #50 (S2-1: free ticket holds and inventory) at fcc6142: pass ([comment](https://github.com/rojandhimal/onetickets/pull/50#issuecomment-6316316199)).
    - Verified INV-1 and INV-2 atomic conditional hold reservations on `inventory.ticket_inventory` (`WHERE sold + held + :qty <= capacity`) and concurrent buyer stress test (50 concurrent buyers racing for 10 spots: 10 succeed, 40 fail). Mutation test caught by 4 integration tests.
    - Verified INV-3 sweeper concurrency (2 sweepers across 100 expired holds release exactly 100 with no underflow) and 20-minute maximum hold lifetime cap.
    - Verified INV-15 / ARCH-2 separation between `sold_out` (`sold >= capacity`) and `all_taken` (`sold + held >= capacity` while `sold < capacity`).
    - Verified INV-4 per-order limit guard (`422 invalid_quantity`).
    - Verified forced RLS on `inventory.holds` (`holds_tenant`, `holds_public`, `holds_worker`).
    - Updated rows 1.1 to 1.5 in [project/qa/sprint-2-checklist.md](/project/qa/sprint-2-checklist.md) to ✅.
  - Reviewed PR #52 (SEC-14: enforce CSP site-wide with per-request nonce) at c4373a9: failed due to static prerendering of `/auth/verify` omitting nonces from Next bootstrap scripts under `strict-dynamic` CSP, causing 22 Playwright E2E timeouts.
  - Re-reviewed PR #52 diff `c4373a9..926078a`: pass at 926078a ([comment](https://github.com/rojandhimal/onetickets/pull/52#issuecomment-6318266431)). Verified `export const dynamic = 'force-dynamic'` added to `apps/web/src/app/auth/verify/page.tsx`, ensuring per-request nonces attach to all script tags. All 7 CI checks green, including 36 Playwright E2E/axe tests with 0 CSP violations. Marked Row P.1 in [project/qa/sprint-2-checklist.md](/project/qa/sprint-2-checklist.md) as ✅.
- **Next:** Review S2-2 (one-screen free checkout frontend) and S2-3 (signed QR tickets) PRs when opened.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 18 Oct 2026

- **Done:**
  - Reviewed PR #46 (BE-1: catalogue backend hardening) at ddb0b28: pass. Verified startsAt validation, PlacesProvider resolution (422 unknown_place), public repository queries selecting only public SQL columns and stripping online URLs in SQL, integration tests, and docs. Posted verdict on PR #46.
  - Reviewed PR #47 (Docs: local email sign-in & Mailpit inbox) at a1888ad: pass. Verified port :8025, /signin flow, 15-minute link expiry, example.test domain, and troubleshooting. Posted verdict on PR #47.
  - Reviewed PR #48 (SEC-20 part 2: explicit attendee contact email before publish) at 5b7d411: pass. Verified contact email publish requirement, visible prefill on Details, focus handling on Change/Add from Review, no silent draft backfills, and no contact email leakage on public routes. Posted verdict on PR #48.
  - Completed Sprint 1 integrated acceptance pass on `main` at 8655fc8 across all 5 stories (S1-1, S1-2, S1-3, S1-4, S1-5). Wrote [project/qa/sprint-1-acceptance.md](/project/qa/sprint-1-acceptance.md) accepting Sprint 1 with staging deferrals recorded.
  - Prepared Sprint 2 QA checklist in [project/qa/sprint-2-checklist.md](/project/qa/sprint-2-checklist.md) covering S2-1 (holds and inventory), S2-2 (one-screen checkout), S2-3 (signed QR tickets), S2-4 (attendee portal/release), and prerequisites (SEC-14 site-wide CSP, SEC-20 attendee contact email).
- **Next:** Sprint 2 reviews (S2-1 holds, S2-2 free checkout, S2-3 QR signing, S2-4 My tickets) as PRs open.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 16 Oct 2026 (late afternoon: #36, #37, #38, #39)

- **Done:**
  - [#36](https://github.com/rojandhimal/onetickets/pull/36#issuecomment-6214279962) passes at 9314016.
  - [#37](https://github.com/rojandhimal/onetickets/pull/37#issuecomment-6214281067) passes at e585e44, with one wording nit: pg_catalog is searched first unless the session lists it later.
  - #38: Security's catch is fixed. The api log sits in a hidden folder that upload-artifact skipped, so 0012d4a adds `include-hidden-files`.
  - [#39](https://github.com/rojandhimal/onetickets/pull/39#issuecomment-6214319585) SEC-5 passes at 2a21efc. The ALB takes only Cloudflare ranges. A spoofed XFF can't move the rate-limit key or the api client IP; I checked locally that the Next rewrite passes XFF through unchanged. Staging is api-staging.<domain>. Five notes are on the PR, none blocking.
- **Next:** CI green on #38 at 0012d4a. Re-check #35. Review S1-5, then Sprint 1 acceptance on main.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 16 Oct 2026 (afternoon: #32, #33, QA-2, #34, #35)

- **Done:**
  - [#32](https://github.com/rojandhimal/onetickets/pull/32#issuecomment-6209417345) passes: one-way copies, merged progress logs and exit 1 on a board conflict all work. Deletes don't propagate.
  - [#33](https://github.com/rojandhimal/onetickets/pull/33#issuecomment-6209423168) passes: retention values match the infra.
  - QA-2 root-caused. The test left Basics before the picked venue's lookup and autosave finished, so publish was refused for a missing venue. A 1.5 s delay on the place lookup reproduces it every time. Fixed in [#38](https://github.com/rojandhimal/onetickets/pull/38) with the `pickMarrickville` helper, plus a trace upload when CI fails.
  - Updated checklist rows 1.3 and 4.4 for the About placeholder prompts.
  - [#34](https://github.com/rojandhimal/onetickets/pull/34#issuecomment-6214131905) passes: the SQL copy and the api agree on 30,000 fuzzed strings, and all 3 mutations were caught.
  - [#35](https://github.com/rojandhimal/onetickets/pull/35#issuecomment-6214251389) S1-4 at 67e2c86: rows 4.1 to 4.4 and the 1.3 prompts pass. One fix needed: a mistyped edit erases the saved contact email, and publish then substitutes the publisher's sign-in email. The #31 offline ticket fix (row 1.6) isn't on the branch yet. QA script: qa/scripts/qa35.spec.ts.
- **Next:** Drive #38 to green. Re-check #35 for the contact-email fix and the offline ticket fix. Review S1-5, then Sprint 1 acceptance on main.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 16 Oct 2026 (S1-2 #31 post-merge)

- **Done:** Reviewed [#31](https://github.com/rojandhimal/onetickets/pull/31#issuecomment-6209383998) on main at ff36249. Rows 2.1 to 2.7 pass (unit 122/122, e2e 26/26, integration 106/106, plus the QA script qa/scripts/qa31.spec.ts at 375 and 1280 px). One finding must be fixed before Sprint 1 acceptance (it rides S1-4): ticket edits made offline show "Saved on this phone" but are kept only in memory, are not retried when back online, and are lost when the draft is reopened (row 1.6). Three nits are on the PR. Also re-checked #25 at 26d788e (BE-4): pass.
- **Next:** Re-check the offline ticket fix in S1-4, then review S1-4 and S1-5. Run Sprint 1 acceptance on main once both merge.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 16 Oct 2026 (QA-1, #29)

- **Done:** Opened [draft PR #29](https://github.com/rojandhimal/onetickets/pull/29). Reconciled QA-1 from [PM's handoff #28](https://github.com/rojandhimal/onetickets/pull/28): [Sprint 1 checklist](/project/qa/sprint-1-checklist.md) rows 1.3, 3.2 and 4.3 now put starter About in S1-4, distinguish private/no-store event HTML from the 60 s Next data cache and public API caching, require revalidation of every web task, and use the final empty-access copy with no public contact link or email. Row 4.4 now explicitly checks the relocated template starter About text with S1-4. Recorded existing #17/#23 reviews and #25/#26 combined-branch evidence separately; #25 and #26 are still open drafts. Added the source-of-truth guidance to [testing docs](/docs/testing.md). Markdown formatting, local links and whitespace checks pass. Checklist statuses and staging deferrals are unchanged; this is a documentation reconciliation, with no new product acceptance run.
- **Next:** Review S1-2, then S1-4 (including starter About and private attendee contact email), then S1-5. After the remaining stories and revalidation PRs merge, run Sprint 1 acceptance on `main`, carrying forward the linked review evidence and recording deferred staging checks.
- **Blocked:** Cloudflare/deployed revalidation, 4G performance and real chat-app preview checks still wait on tegs's AWS account; Google OAuth staging checks wait on the OAuth client. RES-1 recruitment remains with tegs for organiser usability evidence.

## 16 Oct 2026 (#23, #25, #26 reviews)

- **Done:** S1-3 event page [#23](https://github.com/rojandhimal/onetickets/pull/23#issuecomment-6205249552) passes at 8fe2535, with one e2e change before merge: the guest page opens in a context the CSP guard doesn't watch. Rows 3.1 and 3.4 to 3.10 check out as a guest, and revalidation works. Not blocking: `purpose: prefetch` requests skip the enforced CSP (for Security), and organisation names keep markup (sent to BackendDev). Asked PM to accept or adjust 3.2, since ADR 0018 means no edge caching. Scripts are in qa/scripts/qa23*.spec.ts.
- **Done (later):**
  - #23 passes its re-check at 01f1065: the CSP guard now catches an un-nonced script, and prefetches get the CSP.
  - [#25](https://github.com/rojandhimal/onetickets/pull/25#issuecomment-6205358980) passes at 2045726, with five mutations caught.
  - [#26](https://github.com/rojandhimal/onetickets/pull/26#issuecomment-6205360510) needs a change or a PM call. Revalidation reaches only one web task, and production runs two; I reproduced the stale second instance.
  - Main plus #23, #25 and #26 passes e2e 24/24, and a live edit shows on the next load.
  - Reworded 3.2 in qa/sprint-1-checklist.md to match PM's caching decision.
- **Done (BE-4):** [#25](https://github.com/rojandhimal/onetickets/pull/25#issuecomment-6205540604) passes at 26d788e. With two web instances behind one hostname, an edit shows on both. A single-target control left the second instance stale. With one instance down, the other still updates. Four mutations, all caught.
- **Next:** Run the full Sprint 1 demo once S1-2, S1-4, S1-5 and #23 are on main; the slice that exists already works. #26 now passes at b35323c (Cloud Map is multivalue), PM accepted the multi-task gap for now as BE-4, due before production. #25's pass stands. BE-4 is checked; it closes when #25 merges. PM wants only the full demo, no partial one.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 15 Oct 2026 (afternoon)

- **Done:** SEC-10 cap and alarm [#21](https://github.com/rojandhimal/onetickets/pull/21#issuecomment-6193287440) fails QA at 688b756 on one point. The cap, log line, metric filter and wiring work against a live api. But the warning is logged only once, when the cap is crossed, so the alarm emails "OK" within 5 to 10 minutes while links are still being refused. I suggested dropping `ok_actions` on that alarm. BE-1 [#22](https://github.com/rojandhimal/onetickets/pull/22#issuecomment-6193404491) passes at 2208a16, with one test to add: a mutation going back to on-sale-only pricing on the page survives. I asked PM which ticket types the "from" price should count before Sprint 4. #17 still passes after main was merged in (7b6989f).
- **Done (re-check):** #21 passes at 6132f8c. The alarm no longer sends an OK email, and the warning text is pinned by a test.
- **Done (re-check):** #22 passes at 2c3ef7c. The new test catches the on-sale-only mutation.
- **Done (re-check):** #22 passes at 0306ebf with PM's "from" rule. Three mutations, all caught. The free/paid filter still uses all types; that's documented, and I'll check it in Sprint 4. At 3be9651 the rule moved into one SQL function used by the card, the page and the filter, and it passes. I asked for a stronger SQL/TS on-sale parity test, not blocking, because four boundary mutations survive. At 478a91b it passes with nothing left: the edge-parity test catches all four.
- **Next:** Run the Sprint 1 demo end to end once #17 merges.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 15 Oct 2026 (midday)

- **Done:** S1-1 wizard [#17](https://github.com/rojandhimal/onetickets/pull/17#issuecomment-6191742931) passes its QA re-check at 80636d9, tested merged with #16, with all three blockers fixed. e2e passed 20/20 on two runs. A build made with the flag off works when the flag is turned on at runtime. Three mutations, all caught. The starter About text moves to S1-4.
- **Next:** Check S1-4 and the remaining Sprint 1 PRs against qa/sprint-1-checklist.md. After #16 and #17 merge, run the Sprint 1 demo end to end on main.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 15 Oct 2026 (night)

- **Done:** S1 api [#16](https://github.com/rojandhimal/onetickets/pull/16#issuecomment-6186955784) passes its QA re-check at 65cb3e3, with all four blockers fixed. Integration passes 95/95, and also 95/95 merged with #19. Of 11 mutations, 9 are caught and the 2 survivors are equivalent because RLS already filters. A 300k-string fuzz of the sanitiser found no markup in its output.
- **Next:** Re-check #17 when FrontendDev pushes.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 15 Oct 2026 (evening)

- **Done:** DevOps [#19](https://github.com/rojandhimal/onetickets/pull/19#issuecomment-6186807224) passes QA at 09185d6. Compose, migrate and db-roles run as the non-superuser owner. Sign-in and MFA work through Mailpit. Integration passes 65/65 and e2e 14/14 with the default URLs. Merged with #16, integration passes 87/87.
- **Next:** Re-check #16 and #17 when they're pushed.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 15 Oct 2026 (later)

- **Done:**
  - Sprint 0 accepted after #18 merged ([qa/sprint-0-acceptance.md](/project/qa/sprint-0-acceptance.md)).
  - S1 api [#16](https://github.com/rojandhimal/onetickets/pull/16#issuecomment-6186532620) fails at 75d61be: INV-1 is missing, the SEC-3 sanitiser can be bypassed, the paid flag can be bypassed on edit, and several guards have no tests.
  - S1-1 wizard [#17](https://github.com/rojandhimal/onetickets/pull/17#issuecomment-6186700680) fails at ae1cc66: a build without the flag serves a static 404, a closed draft can't be reopened, and there are no e2e specs. The live run at both widths was clean on axe and CSP.
  - The wizard Playwright scripts are in qa/scripts/ for porting to e2e.
- **Next:** Check DevOps #19 (non-superuser migrations). Re-check #16 and #17 when they're pushed.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 15 Oct 2026

- **Done:** Ran the Sprint 0 acceptance pass on main: [qa/sprint-0-acceptance.md](/project/qa/sprint-0-acceptance.md). Everything passes except the web Docker image build, which I fixed in [#18](https://github.com/rojandhimal/onetickets/pull/18). #13 and #14 both passed QA and merged.
- **Next:** Accept Sprint 0 when #18 merges green. Review the S1 api and S1-1 wizard PRs against qa/sprint-1-checklist.md.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client. tegs needs to set the GitHub default branch to `main`.

## 10 Oct 2026

- **Done:** Opened [#13](https://github.com/rojandhimal/onetickets/pull/13): every e2e page now fails on any CSP violation, and local e2e defaults DATABASE_URL. Docs are updated in the same PR. [#12](https://github.com/rojandhimal/onetickets/pull/12) passes QA at 765dd28. Wrote the Sprint 1 checks in [qa/sprint-1-checklist.md](/project/qa/sprint-1-checklist.md). Code-reviewed S0-2 infra: it's fine, but the deploy runs wait for AWS. Deviations are no dev account (ADR 0014), a Melbourne backup copy, and a schema per module.
- **Next:** Drive #13 to green. Review the S0-5 api PR, then write the Sprint 0 acceptance note. Review S1 PRs against the checklist.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 9 Oct 2026 (late night)

- **Done:** Local stack [#11](https://github.com/rojandhimal/onetickets/pull/11) passes QA from a clean clone with no .env, and sign-in through Mailpit works with #10 merged locally. [#10](https://github.com/rojandhimal/onetickets/pull/10) still passes at 9e38104 (hourly email cap works). [#9](https://github.com/rojandhimal/onetickets/pull/9) passes at d85301a: CSP reports are scrubbed and there's no eval report on page load.
- **Next:** After #9 and #10 merge, add the e2e no-CSP-violation guard and the local DATABASE_URL default.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client. PM decision needed: the global 300/hour sign-in email cap can lock everyone out if abused.

## 9 Oct 2026 (re-check)

- **Done:** S0-3 sign-in api [#10](https://github.com/rojandhimal/onetickets/pull/10) passes QA at 0ab9ce5: spoofed X-Forwarded-For no longer bypasses the per-IP limit, and the recovery-code RLS test catches the mutation. 60 integration and 14 e2e tests pass, and the browser flow re-run is clean.
- **Next:** Verify local stack [#11](https://github.com/rojandhimal/onetickets/pull/11) from a clean clone with no .env, plus one sign-in through Mailpit; re-check #9 after its CSP fixes.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 9 Oct 2026 (night)

- **Done:** Re-checked docs [#8](https://github.com/rojandhimal/onetickets/pull/8) at f8f3784: pass, merge after #7. Reviewed S0-5 web [#9](https://github.com/rojandhimal/onetickets/pull/9) against a fake Sentry ingest: errors arrive with release and environment, and emails, phone numbers, tokens, cookies and query strings are scrubbed. Asked for two fixes: CSP reports carry full URLs with query strings unscrubbed, and zod's JIT probe triggers a CSP report on every page load.
- **Next:** Re-check #9 and #10 when fixed; add a no-CSP-violation e2e check and the local DATABASE_URL default after they merge.
- **Blocked:** #10 waits on BackendDev's rate-limit fix; staging checks wait on tegs's AWS account and Google OAuth client.

## 9 Oct 2026 (late)

- **Done:** Reviewed S0-3 sign-in api [#10](https://github.com/rojandhimal/onetickets/pull/10) in a real browser: magic link, single use, same email again, cookie flags, sign-out revocation, MFA step-up and axe all pass. QA fail on 3.10: per-IP rate limits can be bypassed with a spoofed X-Forwarded-For through the web proxy. Also asked for a test of the recovery-code RLS policy (a mutation weakening it went uncaught).
- **Next:** Re-check #10 after the fix; review [#9](https://github.com/rojandhimal/onetickets/pull/9) (S0-5 web error tracking) with a production build; add a local DATABASE_URL default to the e2e config after #10 merges.
- **Blocked:** BackendDev's fix for #10 (Security reviewer to weigh in); staging checks on tegs's AWS account and Google OAuth client.

## 9 Oct 2026 (evening)

- **Done:** Reviewed docs PR [#8](https://github.com/rojandhimal/onetickets/pull/8): local-dev steps work as written in a clean clone (api, web, scanner up; integration 25/25). QA pass with three small doc fixes asked for (doc rule missing from the DoD list, no "how to test" line in the PR template, `/organiser` returns 500 until the auth api lands). Merge after #7.
- **Next:** Re-check #8 once fixed; re-test S0-3 signed-in flows when the auth api PR opens; review S0-2 and S0-5 PRs.
- **Blocked:** Staging checks wait on tegs's AWS account and Google OAuth client.

## 9 Oct 2026

- **Done:** Test strategy and Sprint 0 checklist in qa/. QA passed S0-1 ([#1](https://github.com/rojandhimal/onetickets/pull/1)), S0-3 web ([#2](https://github.com/rojandhimal/onetickets/pull/2)) and S0-4 ([#6](https://github.com/rojandhimal/onetickets/pull/6)), all merged. The e2e and accessibility harness ([#5](https://github.com/rojandhimal/onetickets/pull/5)) merged, so every PR now runs browser and axe tests, including the sign-up pages.
- **Next:** Re-test S0-3 signed-in flows when the auth api PR opens; review S0-2 and S0-5 PRs; add the doc-update check to every PR review.
- **Blocked:** S0-2 deploy checks and the staging demo wait on tegs's AWS account; S0-3 Google sign-in on staging waits on tegs's Google OAuth client.
