# Contributing

How work goes from a story on the board to `main`.

## Who does what

The MVP is built by Claude agents working in the OneTickets project, each in its own thread, with
tegs reviewing and merging every pull request.

| Role              | Owns                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| PM                | The sprint board, priorities, merge order                                         |
| BackendDev        | `apps/api`, migrations, the main CI workflow                                      |
| FrontendDev       | `apps/web`, `apps/scanner`                                                        |
| QA                | Test strategy, the e2e suite in `e2e/`, checking PRs against acceptance criteria  |
| DevOps            | `infra/`, Docker, deploy workflows                                                |
| Security reviewer | Threat model, security checklist, the security workflow, reviews of sensitive PRs |
| ProductDesign     | Designs and handoff specs                                                         |
| Docs              | `README.md` and `docs/`                                                           |
| tegs (owner)      | Reviews and merges, accounts and settings only the owner can create               |

If you change something another role owns, say so in the PR description and ask them to review.

## Branches and pull requests

1. Branch from the latest `main`. One story (or one fix) per branch and per PR.
2. Keep the PR small enough to review in one sitting. Split large stories.
3. Run the checks below locally before pushing.
4. Open the PR with the template below. Link the story id (for example S0-3).
5. CI and the security workflow must be green. QA checks the acceptance criteria; the Security
   reviewer reviews anything touching sign-in, roles, payments, QR tickets, the scanner or
   personal data.
6. tegs merges. Never rewrite history on someone else's branch; merge `main` in instead.

## Before you push

```sh
pnpm format            # or format:check
pnpm lint
pnpm typecheck
pnpm test
MIGRATION_DATABASE_URL=postgres://onetickets:onetickets@localhost:5432/onetickets pnpm test:integration
```

For UI changes, also run the e2e suite (see [testing](testing.md)).

## Definition of Done

A story is done when:

- Every acceptance criterion has a check, automated in CI or written as a manual step in that
  sprint's QA checklist, and every check passes.
- Tests run in CI against real Postgres (no database mocks).
- UI works at 375 px wide, by keyboard and with a screen reader (WCAG 2.2 AA).
- The module boundary rule passes.
- Any change to money or inventory has a test of its database invariant.
- The [security checklist](security/checklist.md) "Always" section is ticked, plus any section the
  story touches.
- Unfinished features are behind a feature flag.

## Pull request description

```md
Before: what a user or developer sees today.

After: what they see with this change.

How: a short paragraph on the approach.

Story: S0-x. Security checklist sections: Always, ...
```

## Code conventions

- TypeScript everywhere, strict mode. Prettier formats; ESLint and dependency-cruiser lint.
- Apps share code only through `packages/*`. Api modules talk only through each other's
  `index.ts`. See [architecture](architecture.md).
- Money is whole cents (`Cents`), never floats.
- Validate every request body on the server with the zod schemas in `packages/shared/src/api`.
- SQL is parameterised. Never build SQL from strings.
- Database migrations are new numbered files. Never edit a migration that has been merged.
- Comments explain why, not what.
- Test data uses obviously fake people (`priya@example.test`), never real personal data.
- Never commit secrets. `.env` files are git-ignored; `.env.example` holds names and local-only
  values.

## Documentation

Update the docs in the same PR as the change that makes them wrong: a new environment variable goes
in [local-development.md](local-development.md), a new module or endpoint in
[architecture.md](architecture.md), a decision that changes how people build in
[decisions.md](decisions.md).
