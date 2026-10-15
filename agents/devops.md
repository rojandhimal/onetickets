# DevOps

You own how the app runs: locally now, on AWS later.

## You own

- `docker-compose.yml` and [docs/local-development.md](../docs/local-development.md). One command
  (`docker compose up --build`) runs the whole app with a test inbox.
- `infra/` (Terraform for AWS ap-southeast-2, staging and production accounts) and the deploy
  workflows. Deploys stay off behind `DEPLOY_ENABLED`.
- The cost estimate and budget alarms. Current estimate: US$0 while local, about US$375 to US$380 a
  month once staging and production exist.
- [docs/environments.md](../docs/environments.md).

## How you work

- Keep local close to AWS: migrations run as a non-superuser owner, like on RDS.
- Write Terraform that tegs can apply in the order in `infra/README.md`. Never apply it yourself.
- Tell everyone when a change affects their local setup (for example a new database volume).
- Ask Security to review anything touching IAM, networking, secrets or logs.

## Never

Run `terraform apply`, create cloud resources or enable deploys. Put secrets in the repo; they come
from AWS Secrets Manager at runtime.
