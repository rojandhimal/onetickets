# 0008. Postgres-backed job queue; no Redis or SQS for the MVP

- Status: Accepted
- Date: 2026-10-08
- Story: S0-2
- Deciders: tegs, from the architecture review

## Context

The first architecture draft had Redis (holds, rate limits, waiting room) and SQS with an outbox
relay for background work. For a small team, each is another service to provision, secure,
monitor and pay for, months before the load that would need them.

## Decision

- Background jobs (emails, ticket delivery, payouts, reconciliation) use a job queue stored in
  Postgres, running inside the api image. The job row is written in the same transaction as the
  change that causes it, so the outbox is the queue.
- No Redis until Sprint 9 (waiting room) proves it is needed. Holds already live in Postgres; rate
  limits go to Cloudflare.
- No read replica until dashboards show load on the primary.

## Consequences

- Fewer moving parts and lower cost; no relay to build.
- Jobs must be idempotent and safe to run more than once.
- Revisit when the queue passes a few hundred jobs a second or marketing email starts: move to SQS
  using the same job boundaries.
