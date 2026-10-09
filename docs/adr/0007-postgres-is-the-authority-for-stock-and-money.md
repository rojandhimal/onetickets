# 0007. Postgres is the authority for stock and money; holds by conditional update

- Status: Accepted
- Date: 2026-10-08
- Story: S1-2, S2-1
- Deciders: tegs, from the system architecture and architecture review

## Context

The two failures OneTickets cannot afford are selling the same ticket twice and losing track of a
dollar. A hot on-sale sends thousands of buyers at one ticket type in the same minute. The first
architecture draft used Redis for holds and the waiting room; the review found that a Redis
counter can drift from the database on failover, and that row locks held across a payment call
would queue every buyer behind the slowest card.

## Decision

- PostgreSQL is the single source of truth for inventory and money. Nothing else is ever the
  authority.
- A hold is reserved with one conditional update, for example
  `update ... set held = held + $n where sold + held + $n <= capacity`. Zero rows back means sold
  out. No lock is held across a network call.
- The database enforces the invariant: a CHECK constraint keeps `sold + held <= capacity`, and
  both at or above zero.
- Holds expire (10 minutes) and a sweeper returns stock exactly once.
- "Sold out" means `sold = capacity`, not `sold + held = capacity`, so the waiting room never
  turns buyers away while tickets are only held (architecture review fix 6).

## Consequences

- Correct under concurrency without extra infrastructure.
- Every money or inventory change needs a test that tries to break its invariant, including with
  concurrent clients (see `docs/testing.md`).
- One very hot ticket type could become a contended row. If that happens, split it into inventory
  buckets; this is a later optimisation, not an MVP need.
