# AGENTS.md

Instructions for any AI coding agent working on OneTickets (Claude Code, Codex, Gemini CLI, Cursor,
Copilot, Aider or anything else that reads `AGENTS.md`). Humans should start with the
[README](README.md).

The project is built by a small team of AI agents, each playing one role, with **tegs** (the owner)
reviewing and merging. Nothing here depends on one AI provider: agents in several tools can work at
the same time, or one can take over when another's usage limit runs out. Give each a role from
[`agents/`](agents/README.md) and have it carry on from the current `main`, the shared state graph
in [`project/state/`](project/state/README.md) and the open pull requests, not from where it last
stopped.

## Start here: the state graph

Don't rebuild the project's status from the board, the progress logs and PR history. Read the
graph, which is the source of truth for status:

```sh
node scripts/state.mjs                  # active items, open PRs, roles, what needs tegs
node scripts/state.mjs next <agent> <role>  # your unfinished task first, else unassigned ready ones
node scripts/state.mjs role <role>      # your role's node and items
node scripts/state.mjs show <id>        # one item or PR with its dependencies and links
```

`<agent>` is your AI provider in lowercase (`claude`, `codex`, `gemini`, ...). Every task names the
agent working on it, and an agent holds **one task at a time** per role. Finish your own unfinished
task before taking another. Claim an unassigned one with `node scripts/state.mjs claim <id> <agent>`
and a draft PR whose title starts with its id. PM releases a claim after more than 5 days without
activity (working agreement sections 4 and 5). Update the graph in the same PR as your work
(`node scripts/state.mjs set <id> status=review prs+=55`). The protocol is in
[project/state/README.md](project/state/README.md).

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
| `project`         | State graph, board, progress logs, design handoffs, QA checklists   |

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
3. **One branch per role at a time, one owner per card, one task at a time.** Start each PR from the
   latest `main`. Before you build, check open pull requests and claim the card in the graph and
   with a draft PR, because agents in other tools may be working at the same time (working
   agreement, sections 4 and 5). Use your tool's branch
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
6. **Update the state graph and log your progress.** In each PR, update your role node and your
   items in `project/state/graph.jsonl` with `node scripts/state.mjs set`, and add a dated entry to
   `project/pm/progress/<role>.md`, newest first: Done, Next, Blocked. Only edit your own log.
7. **Ask through the board, not by guessing.** Decisions that change scope, cost or what users see
   go to tegs. Record them as decision nodes in the graph and in the decisions log in
   `project/pm/board.md`.
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
