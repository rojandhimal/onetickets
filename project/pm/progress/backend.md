# Progress: backend

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-15 (evening)

- **Done:** I fixed QA's four #16 blockers in 4cc4e2b:
  - INV-1 inventory table with the sold+held<=capacity CHECK and sync triggers.
  - A fixed-point SEC-3 sanitiser.
  - A test for the paid-ticket check on edits.
  - Role, browse and pinned-clock DST tests, verified by mutation.
  - docs/backend/catalogue.md.
    Earlier today: Security passed #16 at 8abb201 (RDS migration fix and Clear-Site-Data on sign-out).
- **Next:** QA and Security re-checks, and #16 CI green. Then the S3 banner adapter.
- **Blocked:** nothing.

## 2026-10-15 (later)

- **Done:** I fixed Security's #16 review (82acc18 and 05c061d):
  - Public names and venue text are now cleaned to one line. This was the blocker.
  - Banner uploads are checked by file signature before decoding.
  - organiser_name() is owned by a NOLOGIN ot_public_reader role.
  - The upload rate limit and concurrency are left for SEC-15.
  - Docs and ADR 0017 are updated. All checks pass locally, with 88 integration tests.
- **Next:** Drive #16 CI green, through QA and the Security re-check. Then the S3 banner adapter, once DevOps has the bucket.
- **Blocked:** nothing.

## 2026-10-15

- **Done:** #14 (S0-5 api) merged on 10 Oct, which closes Sprint 0. I restarted my branch from main and opened the S1 api as draft [#16](https://github.com/rojandhimal/onetickets/pull/16). It includes the BannerDto.ogUrl preview image FrontendDev asked for, and the integration tests pass locally (87/87). QA and Security have been asked to review it.
- **Next:** Get #16 green and through QA and Security. Then the S3 banner adapter, once DevOps has the bucket.
- **Blocked:** nothing.

## 2026-10-10 (later)

- **Done:** Fixed the #14 review. Error logs now keep their type and stack with PII redacted, an int test covers a throwing route, and the gitleaks false positive is cleared. The S1 api is built locally and all its checks pass (84 integration tests): events with RLS, template drafts with versioned autosave, free ticket types, publish, banners, venue lookup, the public page, browse, SEC-3 plain text, and ADR 0017. The contract is agreed with FrontendDev; the final version is at contracts/events-s1.ts.
- **Next:** Open the S1 api PR as soon as #14 merges. Then the S3 banner adapter once DevOps has the bucket.
- **Blocked:** The S1 PR waits on #14 merging, because I can only push to one branch. #14 waits on CI, QA and Security re-checks, and tegs's review.

## 2026-10-10

- **Done:** S0-5 api observability is up as draft [#14](https://github.com/rojandhimal/onetickets/pull/14). It adds JSON logs with requestId, userId and organisationId, PII masked using the shared redact(), Sentry tagged with environment and release, and traces from web to api to Postgres. Tests prove a PII sample never leaks, and docs are in docs/backend/observability.md. QA, Security and DevOps have been briefed (the Dockerfile CMD needs `--import`).
- **Next:** Agree the S1 events and ticket-type zod contract with FrontendDev in packages/shared. Then build the S1 api: events with RLS, free ticket types, banner storage, public read and browse, and SEC-3 sanitising.
- **Blocked:** nothing. #14 waits on CI, QA and tegs's review.

## 2026-10-09 (evening)

- **Done:** [#10](https://github.com/rojandhimal/onetickets/pull/10) (S0-3 sign-in) passed QA and Security after fixes: MFA enrolment email, revoking the old session on re-sign-in, unspoofable per-IP limits (TRUST_PROXY_HOPS=0 locally), a rolling hourly cap on sign-in emails, and a recovery-code RLS test. CI is green and the PR is marked ready for review.
- **Next:** Merge main into #10 after #7, #8 and #11 land. Then S0-5 api observability on the shared scrubbers from #9.
- **Blocked:** nothing. #10 waits on tegs's review.

## 2026-10-09 (later)

- **Done:** S0-4 merged ([#6](https://github.com/rojandhimal/onetickets/pull/6)). S0-3 sign-in is up as draft [#10](https://github.com/rojandhimal/onetickets/pull/10), with docs (API, env vars, ADR 0002) and the S0-4 docs. It covers magic link, Google behind config, sessions, TOTP MFA, and SES/SMTP/console mail.
- **Next:** Get #10 green, then S0-5 api observability.
- **Blocked:** nothing. #10 waits on CI and tegs's review.

## 2026-10-09

- **Done:** S0-1 monorepo and CI merged ([#1](https://github.com/rojandhimal/onetickets/pull/1)). S0-4 orgs, roles, RLS and step-up MFA rules are up as [#6](https://github.com/rojandhimal/onetickets/pull/6), including QA's tests for audit isolation and the forced-RLS guard. S0-3 auth (magic link, sessions, TOTP MFA, Google behind config, SES/SMTP/console mail) is built locally with 57 tests green. The api Dockerfile and compose Postgres binding went to DevOps (#4).
- **Next:** Open the S0-3 auth PR with docs (API endpoints, env vars, an ADR on sessions and magic links) once #6 merges. Then the CI hardening PR (SHA pins, api-image job) after #4 lands. Then S0-5 api observability.
- **Blocked:** #6 waits on tegs's review. The S0-3 PR can't open until #6 merges, because only one branch is allowed (the decision card on own branches is unanswered).
