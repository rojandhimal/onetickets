# Infrastructure

Terraform for OneTickets on AWS, in Sydney (`ap-southeast-2`). Nothing here has been applied yet.

## Layout

| Path                          | What it is                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organization/`               | Run once in the AWS Organizations management account. Creates the staging and production accounts, the Terraform state bucket, an organization-wide CloudTrail and a monthly budget alert. |
| `envs/{staging,production}/`  | One stack per environment. Each applies `modules/environment` into its own account, choosing sizes and hostnames.                                                                          |
| `modules/environment/`        | One complete environment: KMS key, network, database, app, deploy role, alarms.                                                                                                            |
| `modules/network/`            | VPC over two availability zones, public and private subnets, NAT, S3 endpoint, rejected-traffic flow logs.                                                                                 |
| `modules/database/`           | RDS PostgreSQL 16, encrypted, TLS enforced, with two login secrets: the schema owner (migrations only) and `onetickets_app` (the API).                                                     |
| `modules/app/`                | ECR repositories, ECS Fargate cluster, load balancer with HTTPS, `api` and `web` services, the `migrate` and `db-roles` tasks, private uploads bucket.                                     |
| `modules/email/`              | Amazon SES sending domain with DKIM, an SPF-aligned MAIL FROM domain and a DMARC policy.                                                                                                   |
| `modules/github-deploy-role/` | IAM role GitHub Actions assumes over OIDC to deploy. No long-lived AWS keys anywhere.                                                                                                      |
| `modules/alarms/`             | Email alerts for API 5xx above 1%, API p95 above 300 ms, no healthy tasks, database CPU and storage.                                                                                       |
| `modules/schedule/`           | Staging's out-of-hours schedule: stops the database and scales the services to zero overnight and at weekends.                                                                             |
| `scripts/deploy.sh`           | Runs migrations and `db-roles`, then rolls the services onto new images. Used by `.github/workflows/deploy.yml`.                                                                           |
| `scripts/power.sh`            | Wakes staging up (or puts it to sleep) outside the schedule. Used by the Staging power workflow and by `deploy.sh` when staging is asleep.                                                 |

What differs between environments:

|                     | staging                                             | production                                                    |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| Web / API host      | `staging.<domain>` / `api.staging.<domain>`         | `<domain>` / `api.<domain>`                                   |
| Database            | `db.t4g.micro`, 1-day backups                       | `db.t4g.medium`, Multi-AZ, 14-day backups copied to Melbourne |
| NAT gateways        | none (tasks run in public subnets with public IPs)  | 2 (one per AZ)                                                |
| Tasks               | 1 each of API and web, smallest size, Fargate Spot  | API 2 to 6, web 2, on-demand                                  |
| Hours               | Mon to Fri 7:00 to 22:00 Sydney time, off otherwise | always on                                                     |
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
- Connection URLs use `sslmode=require&uselibpqcompat=true`: traffic is encrypted, but the RDS certificate is not verified yet. Ship the RDS CA bundle in the image and switch to `verify-full` before launch.
- API environment set by Terraform: `APP_ENV` (`staging` or `production`), `WEB_URL` (`https://<web hostname>`), `MAIL_TRANSPORT=ses`, `EMAIL_FROM_DOMAIN` (the SES domain, for example `staging.<domain>`), and `TRUST_PROXY_HOPS=1` (the load balancer appends the client address; the web rewrite forwards it unchanged). Set `api_trust_proxy_hops` to 2 once Cloudflare proxies the hostnames: too high a count lets clients spoof their IP past rate limits.
- API secrets from Secrets Manager: `DATABASE_URL`, `MFA_ENCRYPTION_KEY` (32 random bytes, base64, generated once per environment) and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (empty until filled in by hand, see below).

## What the owner must set up first

These need a person with a credit card and access to the company domain. Nothing else is needed from the owner to apply.

1. **AWS management account.** Create one AWS account to be the management account (it will run no apps). Turn on MFA for the root user, then create an admin user in IAM Identity Center and stop using root.
2. **Two email addresses** for the staging and production accounts' root users. They must be unique; plus-addressing works (`aws+staging@yourdomain`).
3. **An alerts email address** for budget and CloudWatch alarms.
4. **The domain**, with its DNS hosted in Cloudflare (free plan is fine). After each environment's apply, add the records Terraform prints, all as "DNS only" (not proxied) unless noted:
   - `certificate_validation_records`: CNAMEs that let AWS issue the HTTPS certificate.
   - The web and API hostnames as CNAMEs to `load_balancer_dns_name` (these can be proxied).
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

## Applying, in order

Run with admin credentials for the management account (`aws sso login`), Terraform 1.10 or later.

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

The first apply of each environment pauses at the certificate until its validation CNAMEs are in Cloudflare; `terraform output certificate_validation_records` from another terminal shows them. Services have no image to run until the first deploy, so they show as unhealthy until then, which you can trigger from the Deploy workflow's "Run workflow" button once the GitHub variables are set.

The database passwords are generated by Terraform, so they are also in the state files. The state bucket is encrypted and private; only admins should be able to read it.

After the first `terraform init`, commit the generated `.terraform.lock.hcl` files with hashes for every platform the team uses:

```sh
terraform providers lock -platform=linux_amd64 -platform=darwin_arm64
```

## Local development

Local development and CI use docker compose (Postgres) rather than an AWS account or LocalStack:

- LocalStack's free tier is for non-commercial use only, and it does not include SES API v2, which the API sends mail through, or RDS and ECS.
- Email uses a local transport (`MAIL_TRANSPORT` other than `ses`) so nothing is sent.
- Ticket QR signing should sit behind an interface with a local Ed25519 key for development and tests, and AWS KMS (which supports Ed25519 signing in Sydney) in staging and production. Staging is where the real KMS and SES paths are tested.

## Rough monthly cost

From list prices in Sydney, before Cloudflare, Sentry and email. This is an estimate, not a quote.

| Environment | About      | Main costs                                                                                                         |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| staging     | US$45-50   | Load balancer (~US$21, runs all the time), public IPv4 addresses (~US$9), database and tasks only in working hours |
| production  | US$330     | NAT gateways, load balancer, Multi-AZ database                                                                     |
| total       | US$375-380 | The organization budget alert is set at US$450.                                                                    |
