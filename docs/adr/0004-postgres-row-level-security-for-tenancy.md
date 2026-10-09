# 0004. Postgres row-level security for tenant isolation

- Status: Accepted
- Date: 2026-10-09
- Story: S0-4
- Deciders: BackendDev, with the Security reviewer

## Context

Every organiser's orders, attendees and payouts share one database. A single missing
`where organisation_id = ...` in any query would expose another organiser's customers, and code
review alone will not catch that every time.

## Decision

Isolate tenants in the database as well as in the api:

- Shared tables with an `organisation_id`, protected by forced row-level security policies keyed to
  a per-transaction setting (`app.organisation_id`, `app.user_id`).
- The api runs as a non-owner role (`ot_app`) so policies always apply; the schema owner is used
  only for migrations.
- An application guard that denies any route without an explicit access policy.
- A test that fails if any module table is missing RLS, `FORCE` or an `ot_app` policy.

## Options considered

- **Application filtering only**: simplest, but one forgotten filter is a breach.
- **Schema or database per tenant**: strong isolation, but migrations and connection pooling
  multiply with every organiser, which does not fit a small team.

## Consequences

- Every query must run inside `UnitOfWork.run` with a scope; a query outside one sees no tenant
  rows instead of all of them.
- Cross-tenant work (platform admin, reporting) needs a separate role and its own review.
- Policies cost a little per query; acceptable at this scale and indexed on `organisation_id`.
