# Progress: qa

Newest first. Format: date, Done, Next, Blocked.

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
