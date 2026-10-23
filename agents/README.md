# Agent roles

OneTickets is built by AI agents, one per role, coordinated by the PM agent. tegs reviews and
merges. The briefs here are plain Markdown, so any AI tool can play any role.

| Role                               | Owns                                                        | Progress log                                      |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| [PM](pm.md)                        | The board, sprint flow, routing reviews, updates for tegs   | (writes the board)                                |
| [BackendDev](backend.md)           | `apps/api`, `packages/shared`, migrations, main CI workflow | [backend.md](../project/pm/progress/backend.md)   |
| [FrontendDev](frontend.md)         | `apps/web`, `apps/scanner`, web e2e specs                   | [frontend.md](../project/pm/progress/frontend.md) |
| [QA](qa.md)                        | Test strategy, PR acceptance checks, sprint acceptance      | [qa.md](../project/pm/progress/qa.md)             |
| [DevOps](devops.md)                | `infra/`, `docker-compose.yml`, deploy workflows, costs     | [devops.md](../project/pm/progress/devops.md)     |
| [Security](security.md)            | Threat model, checklist, security workflow, reviews         | [security.md](../project/pm/progress/security.md) |
| [ProductDesign](product-design.md) | Design handoffs, UX copy, design review of UI PRs           | [design.md](../project/pm/progress/design.md)     |
| [Docs](docs.md)                    | `README.md`, `docs/` structure, templates, ADR index        | [docs.md](../project/pm/progress/docs.md)         |

## Starting a role in any tool

1. Open the repo in your tool. It reads [AGENTS.md](../AGENTS.md) on its own (Claude Code reads it
   through `CLAUDE.md`, Gemini CLI through `GEMINI.md`).
2. Give it this prompt, with the role filled in:

   > You are the <Role> agent for OneTickets, working as <agent> (claude, codex, gemini, ...). Read
   > AGENTS.md and agents/<role>.md, then run `node scripts/state.mjs` and
   > `node scripts/state.mjs next <agent> <role>`. Finish your own unfinished task first; if you
   > hold none, claim one unassigned ready task with `node scripts/state.mjs claim <id> <agent>`.
   > One task at a time. Follow the rules in AGENTS.md. Open a pull request for your work, and in
   > it update the state graph and your progress log.

3. If the tool can't open pull requests, ask it to push a branch and give you the compare link.

## Switching provider mid-sprint

When one provider's limit runs out, nothing is lost as long as work is pushed:

- Work in progress lives on the role's branch and its pull request. The new agent checks out that
  branch rather than starting again.
- The [state graph](../project/state/README.md) says what each role is doing and what is next,
  which items are ready, what each one waits on, and which reviews each PR has. The new agent
  reads its brief instead of the board and every progress log.
- Review findings live as comments on the pull request, so a new reviewer can see what was asked.

Before stopping, an agent pushes its branch, updates its role node and items in the graph, and
adds a progress entry. That's the whole handoff.

## Several tools at once

Agents in different tools can also work at the same time (tegs, 22 Oct 2026). Coming back after a
break, an agent starts from the current `main`, the state graph and the open pull requests, not from where
it stopped, because another tool may have finished or started its next item. Before building, it
checks the open pull requests and claims its card in the graph and with a draft PR, so each card
has one owner whatever the tool. Every task names its agent, each agent takes one task at a time,
and PM releases a claim after more than 5 days without activity. The rules are in the
[working agreement](../project/pm/working-agreement.md), sections 4 and 5.

## Where shared files live

Claude project threads keep a live workspace in their shared project folder. Agents outside Claude
projects read and write [`project/`](../project/README.md) in the repo, through their pull
requests. PM keeps the two in step with `node scripts/sync-project-files.mjs`, which copies changes
both ways and merges progress logs that both sides added to. Before starting, pull the latest
`main` so `project/` is current.

## Talking between roles

Inside Claude projects, agents send each other messages. Everywhere else, use the pull request:

- Ask for a review by commenting on the PR and naming the role, for example "QA: please review".
- Reviewers post their verdict as a PR comment that starts with `QA: pass`, `QA: fail`,
  `Security: pass`, `Design: approved` or `changes needed`, followed by the findings.
- Each review comes from a separate agent session working as that role, not from the author's own
  subagents. A builder can run its own checks first, but they don't count as the role's review.
- Anything that needs tegs, or blocks another role, goes in the role's progress log under Blocked
  and on the board.
