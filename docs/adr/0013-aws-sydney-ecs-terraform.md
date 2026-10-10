# 0013. AWS Sydney on ECS Fargate and RDS, managed by Terraform

- Status: Accepted (applied later, see ADR 0014)
- Date: 2026-10-09
- Story: S0-2 (PR #4)
- Deciders: tegs, DevOps

## Context

Data should stay in Australia by default (Privacy Act), the team should run no servers of its
own, and every environment should be reproducible. The architecture also left open whether the
web app should run on Vercel or alongside the api.

## Decision

- AWS `ap-southeast-2` (Sydney), across two availability zones, with backups copied to Melbourne.
- Web and api run as containers on ECS Fargate behind a load balancer; Postgres 16 on RDS. The web
  app runs on ECS too, not Vercel, so all data and logs stay in one AWS account per environment.
- Email through SES, QR signing keys in KMS, secrets in Secrets Manager. Cloudflare in front for
  DNS and protection.
- Staging and production are separate AWS accounts under one management account, all defined in
  Terraform (`infra/`).
- GitHub Actions deploys with short-lived OIDC credentials, never stored AWS keys. Production
  deploys need tegs's approval. Deploys stay off until `DEPLOY_ENABLED` is set.

## Consequences

- Managed services only: no servers to patch.
- One image per app, promoted from staging to production unchanged, so build-time values must be
  the same in both.
- Cost is about US$375 to 380 a month once both environments run (staging off out of hours).
