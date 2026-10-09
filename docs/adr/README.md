# Architecture decision records

One file per decision someone will later ask "why did we do it this way?" about. Copy
[0000-template.md](0000-template.md), take the next free number, and add a row below in the same
pull request.

Rules:

- Numbers are never reused. Before picking one, check this list and open pull requests. If two
  PRs clash, the one that merges second renumbers.
- Never rewrite an accepted ADR to change the decision. Write a new one and mark the old one
  "Superseded by".
- Status is Proposed until tegs or the owning role accepts it in a PR review.

| #                                                             | Decision                                                                   | Status   | Owner        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- | ------------ |
| 0001                                                          | Magic-link token in the URL fragment                                       | Accepted | FrontendDev  |
| 0002                                                          | One email-first screen for sign-up and sign-in                             | Accepted | FrontendDev  |
| 0003                                                          | Scrub Sentry events in the app                                             | Accepted | FrontendDev  |
| 0004                                                          | Postgres row-level security for tenant isolation                           | Accepted | BackendDev   |
| [0005](0005-modular-monolith.md)                              | One TypeScript modular monolith with enforced module boundaries            | Accepted | Architecture |
| [0006](0006-pnpm-monorepo.md)                                 | pnpm workspace monorepo with a shared package                              | Accepted | Architecture |
| [0007](0007-postgres-is-the-authority-for-stock-and-money.md) | Postgres is the authority for stock and money; holds by conditional update | Accepted | Architecture |
| [0008](0008-postgres-job-queue.md)                            | Postgres-backed job queue; no Redis or SQS for the MVP                     | Accepted | Architecture |
| [0009](0009-money-in-integer-cents.md)                        | Money in integer cents, one pricing function, double-entry ledger          | Accepted | Architecture |
| [0010](0010-stripe-connect-organiser-is-seller.md)            | Stripe Connect destination charges with `on_behalf_of`                     | Accepted | Architecture |
| [0011](0011-signed-offline-qr-tickets.md)                     | Signed QR tickets checked offline at the door                              | Proposed | Security     |
| [0012](0012-free-tickets-before-paid.md)                      | Free tickets first, with one fulfilment path                               | Accepted | PM           |
| [0013](0013-aws-sydney-ecs-terraform.md)                      | AWS Sydney on ECS Fargate and RDS, managed by Terraform                    | Accepted | DevOps       |
| [0014](0014-local-docker-staging-later.md)                    | Local development with Docker; staging later; no LocalStack                | Accepted | DevOps       |
| 0015                                                          | Magic links and opaque server-side sessions for sign-in                    | Proposed | BackendDev   |

0001 to 0004 and 0015 are in open pull requests (FrontendDev's #9, BackendDev's #10) and get links
when they merge. The next free number is 0016.
