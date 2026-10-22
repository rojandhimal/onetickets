# Infrastructure

Terraform for OneTickets on AWS, in Sydney (`ap-southeast-2`).

**Status: later.** For now OneTickets runs on the owner's computer with `docker compose up` (see [docs/local-development.md](../docs/local-development.md)). Nothing here has been applied, and none of it needs an AWS account to merge: CI only runs `terraform fmt` and `validate`, and the Deploy and Staging power workflows do nothing until the `DEPLOY_ENABLED` repository variable is `true`. Staging and production are set up from this folder when the AWS accounts exist.

## Layout

| Path                          | What it is                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization/`               | Run once in the AWS Organizations management account. Creates the staging and production accounts, the Terraform state bucket, an organization-wide CloudTrail and a monthly budget alert.    |
| `envs/{staging,production}/`  | One stack per environment. Each applies `modules/environment` into its own account, choosing sizes and hostnames.                                                                             |
| `edge/`                       | Cloudflare in front of both environments: proxied DNS for the web and API hostnames, Full (strict) TLS, the origin header, trace-header stripping and the sign-in and CSP-report rate limits. |
| `modules/environment/`        | One complete environment: KMS key, network, database, app, deploy role, alarms.                                                                                                               |
| `modules/network/`            | VPC over two availability zones, public and private subnets, NAT, S3 endpoint, rejected-traffic flow logs.                                                                                    |
| `modules/database/`           | RDS PostgreSQL 16, encrypted, TLS enforced, with two login secrets: the schema owner (migrations only) and `onetickets_app` (the API).                                                        |
| `modules/app/`                | ECR repositories, ECS Fargate cluster, load balancer with HTTPS, `api` and `web` services, the `migrate` and `db-roles` tasks, private uploads bucket.                                        |
| `modules/email/`              | Amazon SES sending domain with DKIM, an SPF-aligned MAIL FROM domain and a DMARC policy.                                                                                                      |
| `modules/github-deploy-role/` | IAM role GitHub Actions assumes over OIDC to deploy. No long-lived AWS keys anywhere.                                                                                                         |
| `modules/alarms/`             | Email alerts for API 5xx above 1%, API p95 above 300 ms, no healthy tasks, database CPU and storage, and the sign-in email cap being reached.                                                 |
| `modules/schedule/`           | Staging's out-of-hours schedule: stops the database and scales the services to zero overnight and at weekends.                                                                                |
| `scripts/deploy.sh`           | Runs migrations and `db-roles`, then rolls the services onto new images. Used by `.github/workflows/deploy.yml`.                                                                              |
| `scripts/power.sh`            | Wakes staging up (or puts it to sleep) outside the schedule. Used by the Staging power workflow and by `deploy.sh` when staging is asleep.                                                    |

What differs between environments:

|                     | staging                                             | production                                                    |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| Web / API host      | `staging.<domain>` / `api-staging.<domain>`         | `<domain>` / `api.<domain>`                                   |
| Database            | `db.t4g.micro`, 1-day backups                       | `db.t4g.medium`, Multi-AZ, 14-day backups copied to Melbourne |
| NAT gateways        | none (tasks run in public subnets with public IPs)  | 2 (one per AZ)                                                |
| Tasks               | 1 each of API and web, smallest size, Fargate Spot  | API 2 to 6, web 2, on-demand                                  |
| Hours               | Mon to Fri 7:00 to 22:00 Sydney time, off otherwise | always on                                                     |
| App log retention   | 30 days                                             | 90 days                                                       |
| Deletion protection | off                                                 | on                                                            |

There is no dev AWS account. Development runs locally with docker compose (see "Local development" below).

Outside staging's hours the database is stopped and both services are at zero tasks. A deploy wakes staging first if it is asleep. To use it in the evening or at a weekend, run the **Staging power** workflow with `up`; the schedule puts it back to sleep at the next 22:00 (or run it with `down`). Staging's tasks are in public subnets, but their security group only accepts traffic from the load balancer, and the database stays in private subnets with no internet route.

Following the architecture review, there is no Redis, SQS or read replica yet. Background jobs use a Postgres-backed queue inside the API image, and production is resized after the Sprint 9 load test.

## How a change reaches production

1. A pull request runs CI (lint, types, unit and integration tests against Postgres).
2. Merging to `main` runs CI again; when it passes, the Deploy workflow builds one image per app (`apps/<app>/Dockerfile`, tagged with the commit), pushes it to staging, runs migrations, and rolls staging onto it.
3. The production job waits for an approval on the `production` GitHub environment. Once approved it copies the same images into production, runs migrations there, and rolls production.

ECS replaces tasks only once the new ones pass health checks, and rolls back on its own if they don't. If migrations or `db-roles` fail, services are not touched. Migrations must be backwards compatible (expand, then contract) so the old code keeps working while the new code rolls out.

## What the app images must provide

- `apps/api/Dockerfile` and `apps/web/Dockerfile`, built from the repository root, for `linux/amd64`.
- The API listens on `PORT` (3001) and answers `GET /health/live` with 200 without touching the database (the load balancer check). Web listens on 3000 and answers `GET /healthz` with 200.
- Web forwards `/api/*` to the API over the private network at `http://api.onetickets.internal:3001` (Cloud Map DNS, the same name in every environment). Next.js evaluates rewrites and `NEXT_PUBLIC_*` values at build time, and the same image runs in staging and production, so build-time values must be identical across environments. `apps/web/Dockerfile` sets `API_URL` to the private address; the task also receives it at runtime. Per-environment browser settings (such as the Sentry environment name) must be read at runtime, not baked in.
- The API image contains its migration command, by default `node dist/database/migrate.js` with `apps/api/migrations` alongside `dist` (change `migrate_command` in `modules/environment` if it moves). It reads `MIGRATION_DATABASE_URL`, which is the schema owner.
- The API reads `DATABASE_URL`, which logs in as `onetickets_app`. That role owns nothing and is a member of the `ot_app` group role the migrations create, so row-level security applies to it. After each migration run, the `db-roles` task (plain `psql`, owner credentials) creates the login if missing, sets its password from Secrets Manager and grants it `ot_app`. A worker login granted `ot_worker` gets added the same way when workers exist.
- Connection URLs use `sslmode=verify-full&sslrootcert=/app/certs/rds-ap-southeast-2-bundle.pem&uselibpqcompat=true`: traffic is encrypted and the API checks that the server's certificate chains to an RDS root and names the instance's endpoint. The API image must ship `apps/api/certs/rds-ap-southeast-2-bundle.pem` at that path (`certs` is in `files` in `apps/api/package.json`, so `pnpm deploy` copies it). The `db-roles` task gets the same bundle as `RDS_CA` and psql runs with `PGSSLMODE=verify-full`. The instance pins `ca_cert_identifier = "rds-ca-rsa2048-g1"`. The bundle is AWS's ap-southeast-2 regional bundle from `https://truststore.pki.rds.amazonaws.com/ap-southeast-2/ap-southeast-2-bundle.pem` (RSA2048, ECC384 and RSA4096 G1 roots, valid to 2061 or later). To rotate the CA: replace the bundle, deploy the API image, then change `ca_cert_identifier`. Apply order matters on an environment whose secrets still hold `sslmode=require`: deploy an API image that contains the bundle before applying, or tasks restarted after the apply fail to read the CA file and won't start.
- API environment set by Terraform: `APP_ENV` (`staging` or `production`), `WEB_URL` (`https://<web hostname>`), `MAIL_TRANSPORT=ses`, `EMAIL_FROM_DOMAIN` (the SES domain, for example `staging.<domain>`), and `TRUST_PROXY_HOPS=2` (Cloudflare and then the load balancer each append to X-Forwarded-For; the web rewrite forwards it unchanged). The count is tied to `behind_cloudflare` in `modules/app` (see "Cloudflare in front" below) and is 1 if that is ever turned off: a count higher than the real number of proxies lets clients spoof their IP past rate limits. `MAGIC_LINK_HOURLY_CAP` comes from `magic_link_hourly_cap` (staging 300, production 1000): the most sign-in emails the whole service sends in a rolling hour, to protect SES reputation. When it is reached the API refuses new links for up to an hour and an alarm emails `alert_email` once (no "OK" email follows, because links can still be refused after the alarm clears); check for a flood of sign-in requests before raising it. `WEB_INTERNAL_URL` (`http://web.onetickets.internal:3000`) and `REVALIDATE_SECRET` (64 random characters that Secrets Manager generates into `<name>/revalidate`, written write-only so the value is never in Terraform state; also given to the web app; bump `revalidate_secret_version` in `modules/app` to rotate it) let the API tell the web app to drop cached public pages after a publish, over the private network. Each web task keeps its own page cache, so the API must signal every task, not just one: Cloud Map answers `web.onetickets.internal` with the address of every healthy web task (multivalue A records, up to 8, 10 s TTL), and the API resolves them all and posts to each. The load balancer answers `/internal/*` with 404. That rule is only defense in depth: ALB path matching doesn't decode percent-encoding, so a path like `/%69nternal/revalidate` may still reach the web app. The bearer secret is the real control, so never drop the web app's secret check. Also `LOG_LEVEL` (`info`), `SENTRY_DSN` (from `sentry_api_dsn` in the environment's `terraform.tfvars`; empty keeps Sentry off) and `SENTRY_RELEASE`, which `scripts/deploy.sh` sets to the image's commit on every deploy. The API logs JSON to stdout, which lands in CloudWatch. Changes to these (or any task setting) reach the running tasks on the next deploy, not at apply: after applying, run the Deploy workflow ("Run workflow" on main) to roll them out.
- API secrets from Secrets Manager: `DATABASE_URL`, `MFA_ENCRYPTION_KEY` (32 random bytes, base64, generated once per environment) and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (empty until filled in by hand, see below).

## What the owner must set up first

These need a person with a credit card and access to the company domain. Nothing else is needed from the owner to apply.

1. **AWS management account.** Create one AWS account to be the management account (it will run no apps). Turn on MFA for the root user, then create an admin user in IAM Identity Center and stop using root.
2. **Two email addresses** for the staging and production accounts' root users. They must be unique; plus-addressing works (`aws+staging@yourdomain`).
3. **An alerts email address** for budget and CloudWatch alarms.
4. **The domain**, with its DNS hosted in Cloudflare (free plan is fine; see "Cloudflare in front" for what Pro adds). Create a Cloudflare API token for `infra/edge` (My Profile > API Tokens > Create custom token) limited to this zone, with Zone: DNS Edit, Zone: Config Rules Edit, Zone: Transform Rules Edit and Zone: Zone WAF Edit. Keep it in a password manager and export it as `CLOUDFLARE_API_TOKEN` only when applying. After each environment's apply, add the records Terraform prints, all as "DNS only" (not proxied):
   - `certificate_validation_records`: CNAMEs that let AWS issue the HTTPS certificate.
   - Not the web and API hostnames: `infra/edge` creates those, proxied. If you created them by hand earlier, delete them before applying `infra/edge`.
   - `email_dns_records`: three DKIM CNAMEs, an MX and an SPF TXT on `bounce.<sending domain>`, and a DMARC TXT on `_dmarc.<sending domain>`. Production sends from the domain itself, so if the domain already sends other email (Google Workspace, for example), set up that provider's SPF and DKIM first, because the DMARC policy is `p=quarantine`.
5. **Google OAuth client** for organiser sign-in, in Google Cloud Console, with authorised redirect URI `https://<web hostname>/api/auth/google/callback` for each environment. After the apply, paste the client id and secret into the `onetickets-<env>/google-oauth` secret (JSON keys `client_id` and `client_secret`) in Secrets Manager; Terraform leaves the value alone after creating it.
6. **SES production access** in the production account (and staging if staging should email people outside the team). New SES accounts can only send to verified addresses until AWS approves a request in the SES console, which usually takes about a day.
7. **GitHub settings** on `rojandhimal/onetickets`:
   - Make `main` the default branch (the Deploy workflow only triggers from the default branch).
   - Create environments `staging` and `production`, both restricted to the `main` branch (Deployment branches: selected branches, `main`). Each environment's AWS role trusts any job running in that environment, so without the branch rule any branch could deploy. On `production`, also add yourself as a required reviewer.
   - After the applies below, set these variables:

     | Where                    | Variable              | Value                                         |
     | ------------------------ | --------------------- | --------------------------------------------- |
     | Repository               | `DEPLOY_ENABLED`      | `true`                                        |
     | Repository               | `SENTRY_WEB_DSN`      | Sentry DSN for the web app (optional, S0-5)   |
     | `staging` environment    | `AWS_DEPLOY_ROLE_ARN` | `deploy_role_arn` output of `envs/staging`    |
     | `staging` environment    | `APP_URL`             | `https://staging.<domain>`                    |
     | `production` environment | `AWS_DEPLOY_ROLE_ARN` | `deploy_role_arn` output of `envs/production` |
     | `production` environment | `AWS_ACCOUNT_ID`      | production account id                         |
     | `production` environment | `STAGING_ACCOUNT_ID`  | staging account id                            |
     | `production` environment | `APP_URL`             | `https://<domain>`                            |

8. **Sentry**, before any DSN goes into `SENTRY_WEB_DSN` (or an API DSN). Browsers send CSP reports straight to Sentry, so they skip the app's own scrubbing. In each Sentry project, under Settings > Security & Privacy:
   - turn on Data Scrubber and Use Default Scrubbers
   - turn on Prevent Storing of IP Addresses
   - add `token`, `code`, `state` and `email` to Additional Sensitive Fields

   Then put the API project's DSN in each environment's `terraform.tfvars` as `sentry_api_dsn` and apply. To check events arrive, set `SENTRY_TEST_ROUTE=on` on the API for a few minutes (ECS console: update the service with a new task definition revision that adds it), call `GET https://api.<host>/health/sentry-test`, then run the Deploy workflow again: every deploy drops `SENTRY_TEST_ROUTE`.

## Before staging goes live

Work the app needs from AWS that isn't built yet. Each item lands with the feature that needs it.

- **Uploaded images (S1 event banners).** Locally they are files in a Docker volume (`BANNER_STORAGE=local`, `BANNER_DIR`). Container disk is lost on every deploy, so in AWS they go to the existing private `uploads` bucket through BackendDev's S3 adapter. Uploads pass through the API, which re-encodes them and strips metadata, so the bucket needs no CORS. Still to do:
  - set `BANNER_STORAGE=s3` and `UPLOADS_BUCKET=<bucket name>` on the API
  - narrow the task role to put, get and delete on the bucket's `banners/` prefix
  - serve banners through CloudFront with origin access control and long caching (every upload gets a new key, so no invalidations), and pass its base as `BANNER_PUBLIC_BASE_URL`, for example `https://cdn.<domain>/banners`

## Applying, in order

Run with admin credentials for the management account (`aws sso login`), Terraform 1.11 or later.

```sh
# 1. Accounts, state bucket, CloudTrail, budget
cd infra/organization
cp terraform.tfvars.example terraform.tfvars   # fill in emails
terraform init && terraform apply
# then uncomment the backend block in main.tf and: terraform init -migrate-state

# 2. Each environment (staging first; production needs staging's account id)
cd ../envs
cp backend.hcl.example backend.hcl             # bucket from `terraform output state_bucket`
cd staging
cp terraform.tfvars.example terraform.tfvars   # account ids, domain, alert email
terraform init -backend-config=../backend.hcl
terraform apply
```

Then put the environment behind Cloudflare, straight after its apply. Until this runs, the load balancer answers every request with 404, because it only serves requests that carry Cloudflare's origin header:

```sh
# 3. Cloudflare (after staging, and again after production with it added to environments)
cd ../../edge
cp terraform.tfvars.example terraform.tfvars   # zone id, state bucket, environments
export CLOUDFLARE_API_TOKEN=...                # the token from step 4 of the owner setup
terraform init -backend-config=../envs/backend.hcl
terraform apply
```

The first apply of each environment pauses at the certificate until its validation CNAMEs are in Cloudflare; `terraform output certificate_validation_records` from another terminal shows them. Services have no image to run until the first deploy, so they show as unhealthy until then, which you can trigger from the Deploy workflow's "Run workflow" button once the GitHub variables are set.

The database passwords are generated by Terraform, so they are also in the state files. The state bucket is encrypted and private; only admins should be able to read it.

After the first `terraform init`, commit the generated `.terraform.lock.hcl` files with hashes for every platform the team uses:

```sh
terraform providers lock -platform=linux_amd64 -platform=darwin_arm64
```

## Cloudflare in front

Security's SEC-5 conditions, which ship together:

- **Only Cloudflare reaches the load balancer.** Its security group allows only Cloudflare's published [IPv4](https://www.cloudflare.com/ips-v4) and [IPv6](https://www.cloudflare.com/ips-v6) ranges (`cloudflare_ipv4_ranges` and `cloudflare_ipv6_ranges` in `modules/app`; check both lists before each apply). The load balancer is IPv4-only today, and the IPv6 rules are already on its security group so a future switch of the ALB to `dualstack` cannot leave IPv6 open or forgotten. Anyone can point their own Cloudflare zone at our load balancer, though, so `infra/edge` also adds an `x-origin-verify` header with a random value from each environment's state, and the load balancer only forwards app requests that carry it. Everything else gets the listener's 404.
- **The client's real IP.** `TRUST_PROXY_HOPS=2`, so the API's per-IP rate limits see the visitor, not Cloudflare.
- **No client-chosen traces in the API.** Cloudflare removes `sentry-trace` and `baggage` from requests to the API hostname and to `/api/*` on the web hostname. Only the web app's server, which calls the API over the private network, continues a trace into the API. Browser traces into the web app's own pages are unaffected.
- **Rate limits at the edge**, per client IP, in front of the API's own per-IP and per-email limits. They cover the sign-in email, magic-link check and MFA check requests (`/api/auth/*` and `/auth/*`), and `/csp-report`, in any letter case and with or without a trailing slash, as the API accepts both:
  - Free plan (the default, `cloudflare_plan = "free"`): one custom rate-limiting rule combines the sign-in endpoints and `/csp-report` into a single shared 20-requests-per-10-seconds per-IP counter, then blocks for 10 s. That is all the free plan allows (one rule, path only, 10 s windows), which means a burst of CSP reports from browsers behind a shared NAT (an office, university, mobile carrier or venue Wi-Fi) can spend that IP's sign-in budget for 10 seconds. Splitting sign-in and CSP reports into separate counters requires the second rule on Pro.
  - Pro plan (`cloudflare_plan = "pro"`, after upgrading the zone): sign-in at 10 a minute, then blocked for 10 minutes; CSP reports at 30 a minute, then blocked for a minute.
- **TLS all the way.** Full (strict) for our hostnames only, so Cloudflare checks the load balancer's certificate. Cloudflare's free edge certificate covers one level below the domain, which is why staging's API is `api-staging.<domain>`.

To turn Cloudflare off for an environment (for example to debug the load balancer directly), set `behind_cloudflare = false` on its environment module: that opens the load balancer to `ingress_cidrs` (and `ingress_ipv6_cidrs` if dual-stack), drops the header check and sets `TRUST_PROXY_HOPS=1` in one apply. Then run the Deploy workflow so the tasks get the new count.

## Local development

Local development and CI use docker compose (Postgres) rather than an AWS account or LocalStack:

- LocalStack's free tier is for non-commercial use only, and it does not include SES API v2, which the API sends mail through, or RDS and ECS.
- Email uses a local transport (`MAIL_TRANSPORT` other than `ses`) so nothing is sent.
- Ticket QR signing should sit behind an interface with a local Ed25519 key for development and tests, and AWS KMS (which supports Ed25519 signing in Sydney) in staging and production. Staging is where the real KMS and SES paths are tested.

## Rough monthly cost

From list prices in Sydney, before Sentry and email. This is an estimate, not a quote.

| Environment | About      | Main costs                                                                                                             |
| ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| staging     | US$45-50   | Load balancer (~US$21, runs all the time), public IPv4 addresses (~US$9), database and tasks only in working hours     |
| production  | US$330     | NAT gateways, load balancer, Multi-AZ database                                                                         |
| Cloudflare  | US$0       | Free plan covers everything in `infra/edge`. Pro (about US$20-25 a month for the zone) only buys stricter rate limits. |
| total       | US$375-380 | The organization budget alert is set at US$450.                                                                        |
