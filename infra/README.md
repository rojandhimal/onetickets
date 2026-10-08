# Infrastructure

Terraform for OneTickets on AWS, in Sydney (`ap-southeast-2`). Nothing here has been applied yet.

## Layout

| Path                             | What it is                                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization/`                  | Run once in the AWS Organizations management account. Creates the dev, staging and production accounts, the Terraform state bucket, an organization-wide CloudTrail and a monthly budget alert. |
| `envs/{dev,staging,production}/` | One stack per environment. Each applies `modules/environment` into its own account, choosing sizes and hostnames.                                                                               |
| `modules/environment/`           | One complete environment: KMS key, network, database, app, deploy role, alarms.                                                                                                                 |
| `modules/network/`               | VPC over two availability zones, public and private subnets, NAT, S3 endpoint, rejected-traffic flow logs.                                                                                      |
| `modules/database/`              | RDS PostgreSQL 16, encrypted, TLS enforced, RDS-managed owner password, and a separate `app_user` secret for the API.                                                                           |
| `modules/app/`                   | ECR repositories, ECS Fargate cluster, load balancer with HTTPS, `api` and `web` services, the `migrate` task, private uploads bucket.                                                          |
| `modules/github-deploy-role/`    | IAM role GitHub Actions assumes over OIDC to deploy. No long-lived AWS keys anywhere.                                                                                                           |
| `modules/alarms/`                | Email alerts for API 5xx above 1%, API p95 above 300 ms, no healthy tasks, database CPU and storage.                                                                                            |
| `scripts/deploy.sh`              | Runs migrations, then rolls the services onto new images. Used by `.github/workflows/deploy.yml`.                                                                                               |

What differs between environments:

|                     | dev                                 | staging                                     | production                                                    |
| ------------------- | ----------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Web / API host      | `dev.<domain>` / `api.dev.<domain>` | `staging.<domain>` / `api.staging.<domain>` | `<domain>` / `api.<domain>`                                   |
| Database            | `db.t4g.micro`                      | `db.t4g.small`                              | `db.t4g.medium`, Multi-AZ, 14-day backups copied to Melbourne |
| NAT gateways        | 1                                   | 1                                           | 2 (one per AZ)                                                |
| API tasks           | 1 to 2                              | 1 to 2                                      | 2 to 6                                                        |
| Deletion protection | off                                 | off                                         | on                                                            |

Following the architecture review, there is no Redis, SQS or read replica yet. Background jobs use a Postgres-backed queue inside the API image, and production is resized after the Sprint 9 load test.

## How a change reaches production

1. A pull request runs CI (lint, types, unit and integration tests against Postgres).
2. Merging to `main` runs CI again; when it passes, the Deploy workflow builds one image per app (`apps/<app>/Dockerfile`, tagged with the commit), pushes it to staging, runs migrations, and rolls staging onto it.
3. The production job waits for an approval on the `production` GitHub environment. Once approved it copies the same images into production, runs migrations there, and rolls production.

ECS replaces tasks only once the new ones pass health checks, and rolls back on its own if they don't. If migrations fail, services are not touched. Migrations must be backwards compatible (expand, then contract) so the old code keeps working while the new code rolls out.

## What the app images must provide

- `apps/api/Dockerfile` and `apps/web/Dockerfile`, built from the repository root, for `linux/amd64`.
- The API listens on `PORT` (3001) and answers `GET /health` with 200. Web listens on 3000 and answers `GET /` with 200.
- The API image contains a migration command; the default is `node dist/migrate.js` (change `migrate_command` in `modules/environment` if it differs). It runs as the database owner and receives `APP_DB_PASSWORD`. Its first migration must create the non-owner login role the API uses, for example `CREATE ROLE app_user LOGIN PASSWORD :'APP_DB_PASSWORD'` if missing, else `ALTER ROLE ... PASSWORD`, so row-level security applies to the API.
- Database settings arrive as `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` and `PGSSLMODE=require`, which node-postgres reads when `DATABASE_URL` is unset. `APP_ENV` is `dev`, `staging` or `production`.

## What the owner must set up first

These need a person with a credit card and access to the company domain. Nothing else is needed from the owner to apply.

1. **AWS management account.** Create one AWS account to be the management account (it will run no apps). Turn on MFA for the root user, then create an admin user in IAM Identity Center and stop using root.
2. **Three email addresses** for the dev, staging and production accounts' root users. They must be unique; plus-addressing works (`aws+dev@yourdomain`).
3. **An alerts email address** for budget and CloudWatch alarms.
4. **The domain**, with its DNS hosted in Cloudflare (free plan is fine). Add the records Terraform prints: certificate validation CNAMEs (DNS only, not proxied) and CNAMEs from each hostname to the load balancer.
5. **GitHub settings** on `rojandhimal/onetickets`:
   - Make `main` the default branch (the Deploy workflow only triggers from the default branch).
   - Create environments `staging` and `production`; on `production`, add yourself as a required reviewer and restrict it to the `main` branch.
   - After the applies below, set these variables:

     | Where                    | Variable              | Value                                         |
     | ------------------------ | --------------------- | --------------------------------------------- |
     | Repository               | `DEPLOY_ENABLED`      | `true`                                        |
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

# 2. Each environment (dev and staging first; production needs staging's account id)
cd ../envs
cp backend.hcl.example backend.hcl             # bucket from `terraform output state_bucket`
cd staging
cp terraform.tfvars.example terraform.tfvars   # account ids, domain, alert email
terraform init -backend-config=../backend.hcl
terraform apply
```

The first apply of each environment pauses at the certificate until its validation CNAMEs are in Cloudflare; `terraform output certificate_validation_records` from another terminal shows them. Services have no image to run until the first deploy, so they show as unhealthy until then, which you can trigger from the Deploy workflow's "Run workflow" button once the GitHub variables are set.

After the first `terraform init`, commit the generated `.terraform.lock.hcl` files with hashes for every platform the team uses:

```sh
terraform providers lock -platform=linux_amd64 -platform=darwin_arm64
```

## Rough monthly cost

From list prices in Sydney, before Cloudflare, Sentry and email: dev about US$90, staging about US$110, production about US$330 (mostly NAT gateways, the load balancers and the Multi-AZ database). This is an estimate, not a quote. Dev can be scaled to zero when nobody is using it.
