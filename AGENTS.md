# AGENTS.md

Instructions for any AI coding agent working on OneTickets (Claude Code, Codex, Gemini CLI, Cursor,
Copilot, Aider or anything else that reads `AGENTS.md`). Humans should start with the
[README](README.md).

The project is built by a small team of AI agents, each playing one role, with **tegs** (the owner)
reviewing and merging. Nothing here depends on one AI provider: if one provider's usage limit runs
out, start another tool, give it a role from [`agents/`](agents/README.md), and carry on from the
board and progress logs in [`project/`](project/README.md).

## What we're building

Event ticketing for Australian organisers: publish an event, give away or sell tickets, check people
in at the door with a phone. Free tickets and QR check-in ship before paid checkout. Public launch is
May 2027 in Sydney and Melbourne. The plan is in [docs/roadmap.md](docs/roadmap.md) and the live
sprint board is [project/pm/board.md](project/pm/board.md).

## Repo map

| Path              | What it is                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `apps/web`        | Next.js site for attendees and organisers (port 3000)               |
| `apps/api`        | NestJS API, one folder per module under `src/modules` (port 3001)   |
| `apps/scanner`    | Mobile web scanner for door staff (Vite + React, port 3002), a stub |
| `packages/shared` | API contracts, roles and money helpers that every app imports       |
| `e2e`             | Playwright and axe tests at 375 px and 1280 px                      |
| `infra`           | Terraform for AWS ap-southeast-2. Never applied by an agent         |
| `docs`            | How things work, ADRs in `docs/adr`, security docs                  |
| `agents`          | One brief per agent role                                            |
| `project`         | Board, progress logs, design handoffs, QA checklists, research      |

## Commands

Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`), Docker.

```sh
pnpm install
docker compose up --build            # whole app: web :3000, test inbox :8025
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
MIGRATION_DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets pnpm test:integration
pnpm build && ./e2e/setup-db.sh && pnpm e2e
```

Full setup is in [docs/local-development.md](docs/local-development.md). Run the checks before every
push; CI runs the same ones.

## Rules every agent follows

1. **tegs merges.** Agents open pull requests and never merge to `main`, push to `main` or approve.
2. **Nothing is applied to AWS.** Terraform and deploy workflows are written and reviewed only.
   Deploys stay off behind `DEPLOY_ENABLED`. Local development is Docker only for now.
3. **One branch per role at a time.** Start each PR from the latest `main`. Use your tool's branch
   naming, or `<role>/<story>` (for example `backend/s1-2-ticket-types`).
4. **Every PR documents itself.** Fill in the PR template (Before, After, How, How to test, story id),
   and update `README.md`, `docs/` or a new ADR in `docs/adr/` in the same PR. See
   [working agreement](project/pm/working-agreement.md).
5. **Reviews before merge.** QA reviews every PR against the story's acceptance criteria. Security
   reviews anything touching auth, sessions, RLS, database migrations, personal data, uploads,
   payments or infra. ProductDesign reviews anything a user sees. Each review comes from a separate
   agent session for that role, not the author's own subagents. On follow-up iterations after an
   initial review, QA does not repeat tests that already passed; re-reviews check only the diff
   since the last reviewed commit (`<last-sha>..<head>`) and any open findings or affected paths. A
   PR is ready for tegs only when CI is green and every reviewer it needs has passed it.
6. **Log your progress.** Add a dated entry to `project/pm/progress/<role>.md`, newest first: Done,
   Next, Blocked. Only edit your own file.
7. **Ask through the board, not by guessing.** Decisions that change scope, cost or what users see
   go to tegs. Record them in the decisions log in `project/pm/board.md`.
8. **Security floor.** No secrets, tokens or real personal data in code, tests, fixtures, logs or
   commits. Test data uses fake people at `example.test`. Use the shared redactor for logs and
   Sentry. Follow [docs/security/checklist.md](docs/security/checklist.md).
9. **Unfinished features sit behind a runtime feature flag.**
10. **Never skip, disable or delete a failing test to get green.** Find the cause.

## Key decisions

ADRs are in [docs/adr](docs/adr/README.md). The ones that shape most work:

- Modular monolith in a pnpm monorepo (0005, 0006)
- Postgres is the authority for stock and money, with row-level security for tenancy (0004, 0007)
- Money in integer cents, prices shown including GST (0009)
- Stripe Connect with the organiser as seller (0010)
- Signed offline QR tickets (0011)
- Free tickets before paid (0012)
- Magic links and server-side sessions, TOTP MFA (0001, 0002, 0015)

## Roles

Each role has a brief in [`agents/`](agents/README.md): PM, BackendDev, FrontendDev, QA, DevOps,
Security, ProductDesign and Docs. To work as one, read its brief, then the board, then that role's
progress log.
