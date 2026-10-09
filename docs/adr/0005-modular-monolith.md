# 0005. One TypeScript modular monolith with enforced module boundaries

- Status: Accepted
- Date: 2026-10-07
- Story: S0-1
- Deciders: tegs, from the system architecture and architecture review

## Context

The MVP is built by a small team (two to four engineers, now Claude threads) and has to be right
about stock and money from day one. Separate services would add network calls, deploys and
failure modes before there is any load that needs them. But a single codebase with no internal
walls tends to turn into one where every part reads every other part's tables.

## Options considered

- **Microservices from the start.** Independent scaling and deploys; far more moving parts than
  the team or traffic justify.
- **Plain monolith.** Simplest to start; nothing stops modules reaching into each other.
- **Modular monolith.** One deployable, split into modules with hard boundaries that could be
  lifted out later.

## Decision

One TypeScript api (`apps/api`, NestJS, chosen for its module system) split into modules that
match business areas: Identity, Catalogue, Inventory, Checkout, Payments, Ledger, Ticketing,
Scanning and Notifications.

- Each module has its own folder and its own Postgres schema, and exposes only its `index.ts`.
- No module reads another module's tables.
- `.dependency-cruiser.cjs` fails CI on imports of another module's internals
  (`no-cross-module-internals`), app-to-app imports, and circular dependencies.
- Modules that must change data together share a transaction by passing the client through
  service calls (`UnitOfWork`), not by importing each other's internals.

## Consequences

- One image to build, one service to deploy and monitor.
- Splitting a module into its own service later means moving a folder and a schema along lines
  already drawn.
- Cross-module side effects (emails, wallet passes, ledger postings after payment) go through
  jobs, so a failed email never rolls back a paid order.
- Revisit when one event regularly needs more than a few hundred checkouts a second: Checkout and
  Inventory are the first candidates to split.
