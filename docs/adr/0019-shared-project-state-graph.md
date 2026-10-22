# 0019. Keep project status in a shared state graph that every AI tool reads first

- Status: Proposed
- Date: 2026-10-22
- Story: STATE-1
- Deciders: tegs, PM

## Context

OneTickets is built by AI agents from more than one provider: Claude project threads and agents in
another tool. When one provider runs out of usage, another picks up the work. From 17 to 22
October the other tool's team closed Sprint 1 and merged #42 to #52 while the Claude threads were
offline, and the returning Claude FrontendDev rebuilt work that had already merged as #48.

Status lived in prose: a 39 KB board, eight progress logs (about 90 KB) and PR comments. Every new
session re-read and summarised them to find out what to do next, which cost tens of thousands of
tokens and still missed things. tegs asked for a shared knowledge graph so switching provider
doesn't need that.

## Options considered

- **Keep the board as the source of truth.** No change, but every session still reads 130 KB of
  prose, and two teams editing one Markdown table conflict often.
- **An external tracker (GitHub Projects, Linear, Notion).** Good views, but each tool needs its
  own connector and credentials, some agents can't reach it, and it adds a service.
- **A plain-file graph in the repo, one JSON node per line.** Any tool reads it without a parser
  beyond JSON, it merges line by line, CI can validate it, and it travels with the code.

## Decision

`project/state/graph.jsonl` is the source of truth for status: sprints, items with owner, status,
dependencies, reviewers and PRs, PR nodes with review verdicts, role nodes with now, next and
blocked, decisions and risks. `scripts/state.mjs` (Node 22, no dependencies) prints a brief, shows
a node with its edges, edits nodes and validates the graph. `pnpm lint` runs the check, so CI fails
on a broken graph or a dangling reference.

Every agent reads the brief at the start of a session and updates the graph in the same PR as its
work. A role claims an item by opening a draft PR named after the item id. PM records merges and
owns new items, decisions and priorities. `scripts/sync-project-files.mjs` carries the graph
between the repo and the Claude shared folder with the other project files. The board and
progress logs stay as narrative and history. The protocol is in
[project/state/README.md](../../project/state/README.md).

## Consequences

- A new session reads about 50 lines instead of the board and every log.
- Agents write status twice for now: the graph, plus a short progress-log entry. If the logs stop
  being read, PM can propose dropping them.
- The graph can go stale between merges. The brief warns when `main` has moved past the commit the
  graph records.
- Two edits to the same node in the same window conflict, and PM settles them.
- Revisit if the team adopts a hosted tracker every tool can reach, or if the graph grows past a
  few hundred nodes and needs archiving.
