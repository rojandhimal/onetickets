# Architecture

How OneTickets fits together today, and the rules that keep it that way as it grows.

## The big picture

```
 Browser (attendee or organiser)        Door staff phone
          │                                     │
          ▼                                     ▼
   apps/web (Next.js)                    apps/scanner (Vite + React)
          │  /api/* forwarded                    │  (from Sprint 3)
          ▼                                     ▼
   apps/api (NestJS, one module per business area)
          │
          ▼
   Postgres 16 (one schema per module, row-level security on tenant data)
```

Later sprints add Stripe Connect (payments and payouts), an email provider (magic links, tickets,
receipts) and a key service for signing QR tickets. Locally these are replaced by Postgres in
Docker, a local mail inbox and a local signing key; there is no LocalStack (see
[ADR 0014](adr/0014-local-docker-staging-later.md)).

## Apps and packages

| Package           | Role                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`        | Public event pages, checkout, organiser sign-up and dashboard. Server components call the api with the user's cookie; the browser calls `/api/*` on the web origin, which Next forwards to the api, so the session cookie stays first-party. Sets security headers (CSP and friends) in `src/lib/security-headers.ts`. |
| `apps/api`        | The only thing that talks to the database. A modular monolith: NestJS modules under `src/modules`.                                                                                                                                                                                                                     |
| `apps/scanner`    | Door check-in app for phones, offline-capable. A placeholder until Sprint 3.                                                                                                                                                                                                                                           |
| `packages/shared` | Code every app needs: API request and response contracts (zod), roles and permissions, money helpers.                                                                                                                                                                                                                  |

Apps never import each other. They share code only through `packages/*`.

## Api modules

The api is one deployable split into modules that match the business areas:

| Module        | Owns                                                            | Status          |
| ------------- | --------------------------------------------------------------- | --------------- |
| Health        | `GET /health` (api and database up)                             | Built           |
| Identity      | Users, organisations, memberships, roles, audit events, sign-in | Built           |
| Catalogue     | Events and ticket types                                         | Sprint 1        |
| Inventory     | Capacity, holds, sold counts                                    | Sprints 1 and 2 |
| Checkout      | Orders, idempotent checkout                                     | Sprint 2        |
| Ticketing     | Signed QR tickets, "My tickets"                                 | Sprint 2        |
| Scanning      | Check-in, offline sync                                          | Sprint 3        |
| Payments      | Stripe Connect, webhooks, refunds, payouts                      | Sprints 4, 5, 7 |
| Ledger        | Double-entry journal of every money movement                    | Sprints 4 and 5 |
| Notifications | Emails                                                          | As needed       |

Rules:

- Each module owns its own Postgres schema (for example `identity`). No module reads another
  module's tables.
- A module's public surface is its `index.ts`. Other modules import that file and nothing else.
  The `no-cross-module-internals` rule in `.dependency-cruiser.cjs` fails CI if this is broken.
- Modules that need to change data together share one transaction by passing the transaction
  client through service calls (see `UnitOfWork` below).

### Current endpoints

| Method and path                               | What it does                                      |
| --------------------------------------------- | ------------------------------------------------- |
| `GET /health`                                 | Api and database status                           |
| `POST /auth/magic-link`, `/verify`            | Email a sign-in link, then trade it for a session |
| `GET /auth/google/start`, `/callback`         | Sign in with Google                               |
| `GET /me`, `POST /auth/sign-out`              | Current session; sign out                         |
| `POST /me/mfa/totp/setup`, `/confirm`         | Turn on an authenticator app                      |
| `POST /auth/mfa/verify`                       | Step up with an MFA or recovery code              |
| `GET /me/organisations`                       | Organisations the signed-in user belongs to       |
| `POST /organisations`                         | Create an organisation; caller becomes owner      |
| `GET /organisations/:organisationId/members`  | List members (needs `manageMembers`)              |
| `POST /organisations/:organisationId/members` | Add a member with a role                          |

Request and response shapes live in `packages/shared/src/api`; each module's endpoints are
documented in [docs/api/](api/).

## Data and multi-tenancy

Every organiser's data is fenced off from every other organiser's in two layers: the api checks
membership and role on every route, and Postgres row-level security (RLS) enforces the same thing
underneath, so a missed check in code still returns nothing.

- **Roles in Postgres.** Migrations run as the schema owner. The api connects as a login role
  granted `ot_app`, background jobs as one granted `ot_worker`. Neither is a superuser, because
  superusers skip RLS. Tables use `FORCE ROW LEVEL SECURITY`, so even the owner is fenced.
- **Tenant per transaction.** `UnitOfWork.run()` (`apps/api/src/database/unit-of-work.ts`) opens a
  transaction and sets `app.organisation_id` and `app.user_id` with `set_config(..., true)`, the
  same as `SET LOCAL`. A pooled connection can never carry one request's organisation into the
  next. Unset means "matches nothing".
- **Organisation id comes from the server.** It comes from the signed-in user's membership, and a
  path parameter is checked against it. Never trust an id from a request body or header.
- **Audit log.** `identity.audit_events` is insert-only for every role and blocks deleting an
  organisation that has history.

### Migrations

Plain SQL files in `apps/api/migrations`, applied in name order, each once and in its own
transaction, by `pnpm --filter @onetickets/api migrate`. A Postgres advisory lock stops two
deploys migrating at once. Every migration must be backwards-compatible (expand, then contract)
so a deploy can roll back.

## Roles and permissions

Organisation roles are `owner`, `admin`, `finance` and `door_staff`. The map from role to
permission lives in one place, `packages/shared/src/roles.ts`, and both the api (to enforce) and
the web app (to decide what to show) use it.

| Permission      | owner | admin | finance | door_staff | Also needs MFA |
| --------------- | :---: | :---: | :-----: | :--------: | :------------: |
| `viewMoney`     |   ✓   |   ✓   |    ✓    |            |                |
| `managePayouts` |   ✓   |       |    ✓    |            |       ✓        |
| `manageMembers` |   ✓   |   ✓   |         |            |                |
| `exportData`    |   ✓   |   ✓   |    ✓    |            |       ✓        |
| `scanTickets`   |   ✓   |   ✓   |    ✓    |     ✓      |                |

Only owners can grant `owner` or `finance`.

## Money

Money is always whole cents in integers (`bigint` in Postgres), never floats. One pricing function
will be the only source of fees and totals (`packages/shared/src/money.ts` holds the helpers).
Prices are shown including GST.

## Feature flags

Unfinished features ship behind server-side flags read per request, so staging and production can
differ without a rebuild. Today there is one: `FEATURE_EVENT_WIZARD` (`apps/web/src/lib/flags.ts`).
