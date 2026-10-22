# OneTickets team working agreement: documentation and progress

Set by PM on 9 Oct 2026 at tegs's request. Applies to every team thread: PM, BackendDev, FrontendDev, QA, DevOps, Security reviewer, ProductDesign and Repo documentation.

## 1. Every PR documents its own work

- The **PR description** names the story id (for example S0-3) and says what changed, why, and how to test it locally.
- The PR **updates the repo docs it affects**, in the same PR:
  - `README.md` for setup and run steps
  - `docs/` for how a module or flow works: API endpoints, data model, environment variables, runbooks
  - `docs/adr/NNNN-title.md` for any decision someone would later ask "why did we do it this way?"
- A PR with a user-visible or setup change and no doc update is not Done. QA checks this as part of the Definition of Done.
- The Repo documentation thread owns the doc structure and templates. Ask it if you're unsure where something goes.

## 2. Each thread keeps a progress log

- File: `/project/pm/progress/<role>.md` (pm, backend, frontend, qa, devops, security, design, docs).
- Add a dated entry, newest at the top, whenever you finish a piece of work or get blocked. Keep it to three lines:
  - **Done:** what finished, with PR links
  - **Next:** what you're picking up
  - **Blocked:** what you're waiting on, and who from (or "nothing")
- Only edit your own file. Re-read it before writing, because other sessions share the folder.

## 3. PM rolls it up

- PM reads the progress logs and keeps `/project/pm/board.md` current. Board changes still go through PM.
- The Monday check-in summarises the week for tegs from these logs.
- Keep sending PM a cross-session message for anything that needs a decision or blocks someone else. The log is a record, not a way to ask for things.

## 4. Several AI tools work at once

Decided by tegs on 22 Oct 2026. Agents in different tools (Claude, Codex and others) work on OneTickets at the same time, towards the same goal.

- **Start from the current state, not from where you left off.** Read the latest `main`, the board and the open pull requests before you do anything. Another tool may have finished or started your next item while you were away.
- **Claim a card before you build it.** Check open pull requests and branches pushed in the last day. If nobody has the card, open a draft pull request with the story id in its title straight away. The draft PR is the claim that every tool can see. If someone already has the card, pick another or ask PM.
- **One owner per card, whatever the tool.** Two sessions of the same role in different tools work on different cards, and each keeps to one branch at a time (AGENTS.md rule 3).
- **Board changes go through small PRs.** Each tool's PM starts from the latest `main` and merges the other PM's open board PR into its branch, rather than editing around it, so neither overwrites the other.
- **Reviews count across tools.** A QA, Security or ProductDesign review from any tool is independent of an author in another tool. Don't review a PR that already has a pass from your role at its current head.
- **Progress logs stay one file per role.** Sessions of the same role in different tools add to the same file and name their tool in the entry heading, for example "2026-10-22 (Claude)".
