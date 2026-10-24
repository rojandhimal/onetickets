# Progress: devops

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-24 (Claude, later)

- Done: #71 (SEC-23, nodemailer 10.1.7) merged. Opened draft #75 for SEC-24: jsdom ^30.1.3 in apps/web, so undici is 8.12.3 (was 8.11.2, one high and two moderate advisories). Full `pnpm audit` clean. Format, lint, typecheck and unit tests pass.
- Next: Security and QA review #75. Claim SEC-24 in #75 once PM's #73 merges.
- Blocked: nothing. DEV-2 still waits on tegs' AWS accounts.

## 2026-10-24 (Claude)

- Done: #63 (DEV-7) merged. Opened #71 for SEC-23, which bumps nodemailer from 10.0.10 to 10.1.7 for three moderate addressparser advisories. Unit, integration and lint checks pass. A sign-in email reached Mailpit locally and its link signed in.
- Next: Security and QA review #71. The api sends no ticket emails yet, so only sign-in was checked.
- Blocked: nothing. DEV-2 still waits on tegs' AWS accounts. Dev-only undici advisory via jsdom (web) is outside SEC-23.

## 2026-10-23 (Claude, evening)

- Done: DEV-7 #63, a CI check that the api image carries the RDS CA bundle that `sslrootcert` names. Security passed it at 10f6255. QA found that an empty hash on both sides passed, because the default run shell has no pipefail. Fixed in 13c268d (bash with pipefail, exactly one sslrootcert, both hashes non-empty) and merged main at 184d4f9.
- Next: #63 merged 23:35 UTC after QA and Security passed 184d4f9. Next DevOps card from PM.
- Blocked: nothing. DEV-2 still waits on tegs' AWS accounts.

## 2026-10-23 (Claude, later)

- **Done:** tegs merged DEV-5 [#61](https://github.com/rojandhimal/onetickets/pull/61), after I merged main (#56) into it to clear the conflict. Security and QA passed the delta check.
- **Next:** no DevOps card is ready on the graph. DEV-2 waits on tegs's AWS accounts. Asked PM for the next card.
- **Blocked:** nothing. Reminder for tegs: add Zone: Cache Rules Edit to the Cloudflare token before the next edge apply.

## 2026-10-23 (Claude)

- **Done:** DEV-5 [#61](https://github.com/rojandhimal/onetickets/pull/61) is ready for tegs at 302d454, with all 12 CI checks green and Security and QA passes:
  - Fixed review notes: a 30-day edge TTL, any-case path matching, no caching of 4xx/5xx, and no caching of paths containing "%" or "..".
  - Ported the Next.js 16.4.2 bump from #56 to clear the dependency audit.
- **Next:** pick up the next DevOps card from the graph once #61 merges.
- **Blocked:** nothing. tegs adds Zone: Cache Rules Edit to the Cloudflare token before the next edge apply.

## 2026-10-22 (Claude, evening)

- **Done:** tegs merged SEC-6 [#54](https://github.com/rojandhimal/onetickets/pull/54) (f8d07e9). DEV-5 is up as [#61](https://github.com/rojandhimal/onetickets/pull/61) from fresh main. It's the infra side of S3 banners: the switch, narrower IAM, 30-day version expiry and a Cloudflare cache rule, with no CloudFront. The state graph is updated and Security and QA are asked to review.
- **Next:** drive #61 green and through review.
- **Blocked:** nothing. Before the next edge apply, tegs adds Zone: Cache Rules Edit to the Cloudflare token.

## 2026-10-22 (Claude, later)

- **Done:** Unpaused by PM. SEC-6 [#54](https://github.com/rojandhimal/onetickets/pull/54) is out of draft at 72feb4c, with all 12 CI checks green and BackendDev's pass; Security and QA are asked to review. Main hadn't moved, so no merge was needed.
- **Done:** DEV-5 is claimed through PM. The infra side is built and validated, and committed locally until #54 merges (one branch per role):
  - `banner_storage` (local or s3) sets BANNER_STORAGE and UPLOADS_BUCKET on the API.
  - The task role is narrowed to the uploads bucket's `banners/*`.
  - Old object versions expire after 30 days.
  - An infra/edge Cache Rule caches `/api/public/banners/*` at Cloudflare.
  - No CloudFront, so there's no CSP change and no new hostname.
  - The adapter contract went to BackendDev.
- **Next:** drive #54 through review, then open the DEV-5 PR from fresh main.
- **Blocked:** nothing.

## 2026-10-22

- **Done:** SEC-6 is up as draft [#54](https://github.com/rojandhimal/onetickets/pull/54). Postgres connections in AWS now use `sslmode=verify-full`:
  - The API image ships AWS's ap-southeast-2 RDS CA bundle at `/app/certs`.
  - The RDS instance pins `ca_cert_identifier = rds-ca-rsa2048-g1`.
  - The db-roles psql task verifies against the same bundle.
  - Proved locally against a TLS Postgres: a wrong CA and a wrong hostname are refused by both psql and node-postgres.
  - Sent to Security and BackendDev, and asked PM to route it to QA.
- **Next:** drive #54 to green and through review, then DEV-5 (S3 banner adapter and CloudFront).
- **Blocked:** nothing.

## 2026-10-17

- **Done:** DEV-6 SEC-5 follow-ups: added Cloudflare's published IPv6 ranges (`cloudflare_ipv6_ranges`) and `aws_vpc_security_group_ingress_rule.alb_ipv6` (plus `ingress_ipv6_cidrs` when `behind_cloudflare = false`) in `infra/modules/app` and `infra/modules/environment` so a future switch of the ALB to dual-stack already enforces Cloudflare IPv6 ingress; documented in `infra/README.md` and `docs/environments.md` that Cloudflare Free combines sign-in (`/api/auth/*`, `/auth/*`) and `/csp-report` into one shared 20-requests-per-10-seconds per-IP counter (shared-NAT impact until Pro) and that both `ips-v4` and `ips-v6` must be checked before each apply. Also verified that [#39](https://github.com/rojandhimal/onetickets/pull/39) and [#42](https://github.com/rojandhimal/onetickets/pull/42) merged cleanly on `main`.
- **Next:** SEC-6 (Postgres `sslmode=verify-full` with the RDS CA bundle, with BackendDev) and DEV-5 (S3 banner adapter and CloudFront wiring before staging goes live).
- **Blocked:** nothing.

## 2026-10-16 (later)

- **Done:** [#26](https://github.com/rojandhimal/onetickets/pull/26) merged (3191149) after Security and QA passed it. SEC-5 is ready for tegs as [#39](https://github.com/rojandhimal/onetickets/pull/39) at 2a21efc, with Security and QA passed and CI green. A new `infra/edge` stack puts both environments behind Cloudflare: proxied DNS, Full (strict) TLS, an origin header the ALB requires, sentry-trace and baggage stripped toward the api, and rate limits on sign-in and `/csp-report` that match any letter case and a trailing slash. In the environments, `behind_cloudflare` limits the ALB to Cloudflare's IPv4 ranges and sets TRUST_PROXY_HOPS=2 in the same apply. Staging's API host is now `api-staging.<domain>`. Free plan, US$0; Pro isn't authorised.
- **Next:** SEC-6 (Postgres verify-full with the RDS CA, with BackendDev) from main once #39 merges.
- **Blocked:** nothing. Applying needs tegs's Cloudflare API token (scopes are in the #39 description and infra/README).

## 2026-10-16

- **Done:** [#21](https://github.com/rojandhimal/onetickets/pull/21) merged. It covers SEC-10's DevOps cap part: `magic_link_hourly_cap` per environment (staging 300, production 1000) and an alarm on the cap warning with no OK email, per QA's fix. Revalidate infra for BE-1 is up as draft [#26](https://github.com/rojandhimal/onetickets/pull/26): REVALIDATE_SECRET in Secrets Manager for api and web, web in Cloud Map, `WEB_INTERNAL_URL`, and the ALB returns 404 on `/internal/*`. Per PM, the secret is now generated by Secrets Manager and stored write-only (`secret_string_wo`), so it is never in Terraform state; this needs Terraform 1.11+. The compose value is now 33 characters, which passes the api's minimum.
- **Next:** QA's pass and green CI on #26, then mark it ready. Security has passed it. QA found that a refresh reaches only one of production's 2 web tasks. Cloud Map already returns every task, so the fix is the api posting to each, carded as BE-4 before production; the infra README documents it. Then SEC-5, which is the Cloudflare-only ALB plus edge rate limits and Turnstile, shipping with TRUST_PROXY_HOPS=2 and the sentry-trace strip in the same change. Then SEC-6, Postgres verify-full.
- **Blocked:** nothing.

## 2026-10-15

- **Done:** [#15](https://github.com/rojandhimal/onetickets/pull/15) merged (10 Oct) after Security's re-review. DEV-3 merged as [#19](https://github.com/rojandhimal/onetickets/pull/19): CI and compose now migrate as `onetickets_owner`, which like the RDS master isn't a superuser, and tests seed as postgres. Integration tests pass 88/88 with #16 and #18 merged on top.
- **Next:** SEC-5 and SEC-6, and the MAGIC_LINK_HOURLY_CAP variable. After #19, anyone running compose starts with a fresh local database (new volume).
- **Blocked:** nothing.

## 2026-10-10

- **Done:** [#15](https://github.com/rojandhimal/onetickets/pull/15) S0-5 infra and S1 banner storage. It adds the API Sentry DSN and LOG_LEVEL, sets SENTRY_RELEASE on every deploy, and raises staging log retention to 30 days. Locally, banners use a volume with BANNER_STORAGE=local. infra/README now has a "Before staging goes live" list (S3, CloudFront, BANNER_PUBLIC_BASE_URL). Fixed both of Security's blockers: Terraform env changes now reach the tasks on the next deploy, and deploys drop SENTRY_TEST_ROUTE.
- **Next:** Security re-review and green CI on #15, then tegs merges. After that, SEC-5 and SEC-6, and the MAGIC_LINK_HOURLY_CAP variable.
- **Blocked:** nothing. tegs still needs to switch the repo's default branch to main.

## 2026-10-09 (later)

- **Done:** One-command local stack merged ([#11](https://github.com/rojandhimal/onetickets/pull/11)): web, api, Postgres, migrations and Mailpit with `docker compose up --build`, a non-engineer guide in docs/run-locally.md, and Cloudflare quick-tunnel demo steps. Fixed #4's description to match what merged.
- **Next:** After #8 merges, fold run-locally.md into docs/local-development.md (unless the docs thread does it during their merge). Then SEC-5 and SEC-6, and MAGIC_LINK_HOURLY_CAP as a Terraform variable for launch.
- **Blocked:** nothing.

## 2026-10-09

- **Done:** S0-2 AWS Terraform and deploy pipeline merged ([#4](https://github.com/rojandhimal/onetickets/pull/4)): staging and production accounts only, minimal staging switched off out of hours, all marked "later". One-command local stack (web, api, Postgres, migrations, Mailpit) with a non-engineer guide and Cloudflare quick-tunnel demo steps is up as draft [#11](https://github.com/rojandhimal/onetickets/pull/11). Checked LocalStack (not adopted, see ADR 0014 on #8).
- **Next:** Get #11 green and reviewed. Then SEC-5 and SEC-6 follow-ups, and applying the AWS stacks when tegs creates the accounts.
- **Blocked:** nothing. Magic-link emails reach Mailpit once BackendDev's #10 merges.
