# Environments

| Environment | Where                | Status                         | Used for                                 |
| ----------- | -------------------- | ------------------------------ | ---------------------------------------- |
| Local       | Your machine, Docker | **In use**                     | All development and sprint demos for now |
| CI          | GitHub Actions       | **In use**                     | Checks on every pull request             |
| Staging     | AWS (Sydney)         | Deferred                       | Shared test site, nightly e2e tests      |
| Production  | AWS (Sydney)         | Deferred, needed before launch | Real organisers and buyers               |

## Local (now)

Decided on 9 October 2026: run locally with Docker for now and set up staging later. Local
development needs no AWS account and costs nothing. Postgres runs in Docker; email and ticket
signing use local stand-ins as those features arrive. Setup is in
[local-development.md](local-development.md).

The Sprint 0 demo (an organiser signs up and lands on an empty organiser home) runs locally.

## CI

The Deploy, Infra and Staging power workflows exist but do nothing until AWS is set up: deploys
stay off until the repository variable `DEPLOY_ENABLED` is `true`.

Two workflows run on every pull request and on pushes to `main`:

- **CI** (`.github/workflows/ci.yml`): format, lint and module boundaries, type check, unit tests,
  build, and integration tests against a real Postgres 16.
- **Security** (`.github/workflows/security.yml`): secret scanning with gitleaks and a dependency
  audit that fails on high or critical advisories in production dependencies.

## Staging and production (later)

The Terraform and deploy pipeline are written and merged (`infra/`, see
[infra/README.md](../infra/README.md) for the layout and the order to apply it in), but nothing
has been applied. Nothing in AWS exists yet. The plan:

- Separate AWS accounts for staging and production under one management account, created by
  Terraform. No dev account.
- Containers on ECS Fargate behind a load balancer, Postgres on RDS, email through SES, QR signing
  keys in KMS. Cloudflare in front for DNS and protection.
- Staging is minimal and switched off out of hours (weekdays 7:00 to 22:00 Sydney time).
- Deploys go through GitHub Actions using short-lived OIDC credentials, never stored AWS keys.
  Production deploys need tegs's approval.
- Rough cost once running: about US$375 to 380 a month (staging about US$45 to 50, production
  about US$330), with a budget alert at US$450. US$0 while everything is local.

What tegs needs to set up when the time comes (AWS accounts, a domain on Cloudflare, Google
sign-in client, GitHub environments) is tracked by the PM in the project's owner setup list.
