# Sprint 0 acceptance

QA, 15 Oct 2026. Checked from a clean clone of `main` at a8cdfea (#12, #13, #14 and #15 merged). Row-by-row evidence is in [sprint-0-checklist.md](sprint-0-checklist.md).

## Verdict

**Accepted on 15 Oct 2026.** The one blocker was that the web Docker image didn't build on main. It was fixed in [#18](https://github.com/rojandhimal/onetickets/pull/18), which merged at 04:00 UTC with CI green. Everything below passed. The items under "Deferred to staging" carry over to the first staging deploy.

## What passed (on main at a8cdfea plus #18's fix)

- **Checks.** Format, lint, typecheck and unit tests are clean. Integration passes 65/65 against Postgres 16, and e2e passes 14/14 at 375 and 1280 px with axe and the CSP guard.
- **S0-1 local stack.** `docker compose up --build` brings up postgres, migrate, db-roles, api, web and mailpit from a clean clone with no .env.
- **S0-3 sign-in.**
  - Signing up through the Mailpit link lands on the organiser home in 2.2 s.
  - A link works only once.
  - Signing in again with the same email reuses the existing organisation.
  - The cookie is HttpOnly and Lax.
  - Sign-out revokes the session server side.
  - Requests from another origin get 403, and form-encoded bodies get 415.
  - axe finds no violations and there's no sideways scroll at either width.
- **MFA.**
  - Granting finance or owner needs MFA.
  - A wrong code and a replayed code are both rejected.
  - Enrolling issues 10 recovery codes, and each works once.
  - A new session needs a fresh check.
  - Setting up twice gets 409.
- **S0-4 tenancy and roles.**
  - RLS is mutation-tested.
  - The guard test fails on a table without a policy.
  - Payout routes need MFA and are closed to admin and door staff.
  - A user in two organisations only sees the one requested (QA ad-hoc test, 10 Oct).
- **S0-5 observability.** I ran the api from the compose image against a fake Sentry ingest, with requests carrying an email, name, session cookie and bearer token.
  - None of those values appeared in the api logs, in stderr or in anything sent to Sentry.
  - The test error arrived tagged with environment and release.
  - Error log lines keep their type, message and stack, redacted.
  - Logs carry `requestId`, `userId` and `organisationId`.
  - The web Sentry scrubber and CSP reports were checked on #9.
- **S0-2 infrastructure.** Code review passes, and `terraform validate` is green in CI.

## Deferred to staging (needs tegs's AWS account and Google OAuth client)

- **S0-2 deploy runs:**
  - one image digest deployed to staging and then production;
  - manual approval before production;
  - migrations before traffic;
  - a failed migration stops the deploy.
- **S0-3:**
  - Google sign-in (3.4);
  - SES email delivery;
  - the `Secure` / `__Host-` cookie on https;
  - the load balancer's X-Forwarded-For mode, plus a spoofed-header check (SEC-11);
  - sign-up under a minute, timed on a phone.
- **S0-5:**
  - real Sentry events from web and api, using `SENTRY_TEST_ROUTE=on` and then off again;
  - one trace from web through api to Postgres;
  - log shipping and retention (30 days in staging, 90 in production).
- **Demo:** the Sprint 0 demo run on staging, before 13 Nov.
- **Launch-readiness** ([test-strategy.md](test-strategy.md)): the SEC-10 sign-in email cap with its alarm, Cloudflare and Turnstile.

## Known deviations, accepted

- No dev AWS account (ADR 0014). Production copies RDS backups to Melbourne (`ap-southeast-4`).
- Each module's migration creates its own schema, rather than one first migration creating them all.
- The global cap of 300 sign-in emails an hour is accepted pre-launch, and SEC-10 covers it for launch.

## Found during acceptance, outside the code

- **The repository's default branch on GitHub is `claude/s0-1-monorepo-ci-4i037q`, an old WIP branch, not `main`.** A plain `git clone` checks out the paused scaffold. Only tegs can change this, in the repository's settings under General, Default branch.
- There's no CI job that builds the Docker images. That's how #18's bug got through. I've suggested it to DevOps.
