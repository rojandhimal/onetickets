# 0006. pnpm workspace monorepo with a shared package

- Status: Accepted
- Date: 2026-10-08
- Story: S0-1
- Deciders: tegs (PR #1)

## Context

The web app, the api and the door scanner all need the same request and response shapes, role
rules and money helpers. Keeping them in separate repositories would mean publishing a package
for every change, or copying types and letting them drift.

## Decision

One repository, a pnpm workspace:

- `apps/web` (Next.js), `apps/api` (NestJS), `apps/scanner` (Vite + React).
- `packages/shared` for API contracts (zod), roles and permissions, money helpers.
- Apps never import each other; they share code only through `packages/*` (enforced by
  dependency-cruiser).
- Node 22 and pnpm 10 pinned (`.nvmrc`, `packageManager`), lockfile enforced in CI.

## Consequences

- A change to an API contract updates the api and its callers in one PR, and the type checker
  catches mismatches.
- The roles map in `packages/shared/src/roles.ts` is used by both the api (to enforce) and the web
  app (to decide what to show), so the two cannot disagree.
- Apps import the built shared package, so `pnpm --filter @onetickets/shared build` must run
  before typecheck or dev.
