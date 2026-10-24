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

## 2a. Each PR updates the state graph

- [project/state/graph.jsonl](/project/state/README.md) is the source of truth for status, so the next agent, from any AI tool, reads it instead of the board and every log.
- In each PR, update your role node (now, next, blocked) and your items (status, PRs, waiting) with `node scripts/state.mjs set`. Reviewers record verdicts on the PR node. `pnpm lint` checks the graph.
- Claim an item before starting with `node scripts/state.mjs claim <id> <agent>` and a draft PR whose title starts with the item id (section 5).

## 3. PM rolls it up

- PM records merges in the graph and keeps `/project/pm/board.md` current from it. Board changes still go through PM.
- The Monday check-in summarises the week for tegs from these logs.
- Keep sending PM a cross-session message for anything that needs a decision or blocks someone else. The log is a record, not a way to ask for things.

## 4. Several AI tools work at once

Decided by tegs on 22 Oct 2026. Agents in different tools (Claude, Codex and others) work on OneTickets at the same time, towards the same goal.

- **Start from the current state, not from where you left off.** Read the latest `main`, the state graph (`node scripts/state.mjs`) and the open pull requests before you do anything. Another tool may have finished or started your next item while you were away.
- **Claim a card before you build it.** Check open pull requests and branches pushed in the last day. If nobody has the card, claim it in the graph (section 5) and open a draft pull request with the story id in its title straight away. The draft PR is the claim that every tool can see on GitHub. If someone already has the card, pick another or ask PM.
- **One owner per card, whatever the tool.** Two sessions of the same role in different tools work on different cards, and each keeps to one branch at a time (AGENTS.md rule 3).
- **Board changes go through small PRs.** Each tool's PM starts from the latest `main` and merges the other PM's open board PR into its branch, rather than editing around it, so neither overwrites the other.
- **Reviews count across tools.** A QA, Security or ProductDesign review from any tool is independent of an author in another tool. Don't review a PR that already has a pass from your role at its current head.
- **Progress logs stay one file per role.** Sessions of the same role in different tools add to the same file and name their tool in the entry heading, for example "2026-10-22 (Claude)".

## 5. Every task names its agent, one task at a time

Decided by tegs on 23 Oct 2026 (D19). Every task on the board and in the state graph names the AI agent (provider) working on it, so a session in any tool can see what's free without asking.

- **The assignee is the provider:** `claude`, `codex`, `gemini` and so on, in the item's `agent` field. An item with no agent is unassigned. The board shows it on each card as `[claude]` or `[unassigned]`; the graph is the source.
- **One task at a time.** An agent holds one task per role at a time: one item in progress or blocked. It takes the next only after moving that one to review or done, or giving it up. An item in review stays the agent's to answer review findings on, but doesn't stop it starting the next.
- **At the start of every session,** after reading `main` and the graph:
  1. Run `node scripts/state.mjs next <agent> <role>` (or set `STATE_BY=<agent>/<role>` and run `next`).
  2. Carry on with your own unfinished task first.
  3. Only if you hold none, claim an unassigned ready one with `node scripts/state.mjs claim <id> <agent>`, then open its draft PR (section 4). The claim and the draft PR go together.
- **Stay active.** Any `set` you make on your item with `STATE_BY=<agent>/<role>` records today as its last activity. Update the item at least every few days while you work on it, for example with `waiting` or the PR list.
- **PM releases idle claims.** If an agent hasn't touched its task for more than 5 days (the brief lists these under "Claims for PM to check"), PM checks the item's pull requests for recent pushes. If there are none, PM runs `node scripts/state.mjs release <id>`, which makes the task unassigned and ready again, or reassigns it with `set <id> agent=<other>`. PM says so on the item's PR and in its log. A task waiting on tegs or a reviewer isn't idle.
- **Don't take a task someone else holds.** `claim` refuses it and says when the holder was last active. Ask PM to release it instead.
