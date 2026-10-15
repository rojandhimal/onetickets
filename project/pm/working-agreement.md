# OneTickets team working agreement: documentation and progress

Set by PM on 9 Oct 2026 at tegs's request. Applies to every team thread: BackendDev, FrontendDev, QA, DevOps, Security reviewer, ProductDesign and Repo documentation.

## 1. Every PR documents its own work

- The **PR description** names the story id (for example S0-3) and says what changed, why, and how to test it locally.
- The PR **updates the repo docs it affects**, in the same PR:
  - `README.md` for setup and run steps
  - `docs/` for how a module or flow works: API endpoints, data model, environment variables, runbooks
  - `docs/adr/NNNN-title.md` for any decision someone would later ask "why did we do it this way?"
- A PR with a user-visible or setup change and no doc update is not Done. QA checks this as part of the Definition of Done.
- The Repo documentation thread owns the doc structure and templates. Ask it if you're unsure where something goes.

## 2. Each thread keeps a progress log

- File: `/project/pm/progress/<role>.md` (backend, frontend, qa, devops, security, design, docs).
- Add a dated entry, newest at the top, whenever you finish a piece of work or get blocked. Keep it to three lines:
  - **Done:** what finished, with PR links
  - **Next:** what you're picking up
  - **Blocked:** what you're waiting on, and who from (or "nothing")
- Only edit your own file. Re-read it before writing, because other sessions share the folder.

## 3. PM rolls it up

- PM reads the progress logs and keeps `/project/pm/board.md` current. Board changes still go through PM.
- The Monday check-in summarises the week for tegs from these logs.
- Keep sending PM a cross-session message for anything that needs a decision or blocks someone else. The log is a record, not a way to ask for things.
