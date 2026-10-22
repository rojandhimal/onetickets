# Project state graph

[`graph.jsonl`](graph.jsonl) is the team's shared record of where the project is: sprints, work
items, who owns them, their status, their pull requests, review verdicts, dependencies, decisions
and risks. Any AI tool or person can read it, and it is the **source of truth for status**. The
[board](../pm/board.md) and the progress logs keep the narrative and the history, but you don't need
to read them to find out what to do next.

Why: agents from more than one provider take turns on OneTickets. Re-reading the board, eight
progress logs and the PR history to rebuild the picture costs tens of thousands of tokens every
session. The graph is about 20 KB, and its brief is about 50 lines.

## At the start of a session

```sh
git pull                                  # the graph on main is the shared copy
node scripts/state.mjs                    # brief: active items, open PRs, roles, what needs tegs
node scripts/state.mjs role <your-role>   # your role's node, what you own, what you review
node scripts/state.mjs show <id>          # one item or PR with everything linked to it
```

No Node? Read `graph.jsonl` directly: one JSON object per line, so `grep '"status":"ready"'` or
`grep '"owner":"backend"'` works too.

The brief says when `main` has moved since the graph was last updated. Then check what merged since
(`git log --oneline <graph main>..origin/main`) before trusting the statuses.

Before starting an item, check that nobody else holds it: look at its status and the open pull
requests. Claim it by opening a draft PR whose title starts with the item id (for example
`S2-2: one-screen free checkout`) and by setting the item `in_progress` in that PR. Two teams can
be active at once (risk R8), and a draft PR is the claim everyone can see straight away.

## When you finish a piece of work

Update the graph **in the same PR** as the work, with `set` (it keeps one node per line and checks
the result):

```sh
node scripts/state.mjs set S2-2 status=review prs+=55
node scripts/state.mjs add '{"type":"pr","id":"#55","title":"S2-2: one-screen free checkout","item":"S2-2","branch":"frontend/s2-2-checkout","state":"open","author":"frontend","tool":"codex","reviews":{}}'
node scripts/state.mjs set frontend now="S2-2 in review (#55)" next="DES-10" blocked=nothing tool=codex
```

Reviewers record their verdict on the PR node, with the commit they reviewed:

```sh
node scripts/state.mjs set '#55' reviews.qa=pass@1a2b3c4
```

Set `STATE_BY` to say who you are (for example `STATE_BY=codex/frontend`) and `set` stamps it on
the meta node with today's date. `pnpm lint` runs `node scripts/state.mjs check`, so CI fails on a
broken graph.

Still add your three-line entry to your progress log. The log is the history; the graph is what the
next agent reads.

## Who updates what

| Change                                                | Who                                                     |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Your role node; your item's status, PRs and `waiting` | The role doing the work, in its PR                      |
| A PR node's `reviews`                                 | The reviewer, in a PR or through PM                     |
| Merges (`state=merged`, `merged=<sha>`, items done)   | PM after tegs merges, with `meta.main`                  |
| New items, sprints, decisions, risks, priorities      | PM, with tegs for scope, cost or user-visible decisions |

Claude project threads edit the copy in the shared project folder; PM's
`node scripts/sync-project-files.mjs` carries it both ways like the other project files. Changes to
different nodes merge cleanly because each node is one line. Two edits to the same node are a
conflict for PM to settle.

## Node types

Every line has `type` and a unique `id`. Fields that name another node are the graph's edges.

| Type       | Id                                     | Required fields                            | Edges and other fields                                                                                                |
| ---------- | -------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `meta`     | `meta`                                 | `updated`, `by`, `main`, `sprint`, `phase` | `sprint` names the current sprint; `main` is the main commit the graph matches                                        |
| `sprint`   | `S0` to `S10`                          | `name`, `status`                           | `status`: planned, in_progress, done; `accepted`, `evidence`                                                          |
| `role`     | `pm`, `backend`, …, `tegs`             | `name`, `now`, `next`, `blocked`           | `tool` last used, `brief`, `log`                                                                                      |
| `item`     | story or card id, e.g. `S2-2`, `SEC-6` | `title`, `status`, `owner`                 | `owner` → role; `deps` → items; `reviewers` → roles; `sprint` → sprint; `prs` → PR numbers; `waiting`, `spec`, `note` |
| `pr`       | `#54`                                  | `title`, `state`, `branch`                 | `item` → item; `author` → role; `reviews` as `{role: "pass@sha"}`; `head`, `merged`, `ci`, `tool`                     |
| `decision` | `D01`, `D02`, …                        | `date`, `text`, `by`                       |                                                                                                                       |
| `risk`     | `R1`, `R2`, …                          | `text`, `owner`, `status`                  | `status`: open, closed; `action`                                                                                      |

Item `status` is one of backlog, ready, in_progress, review, blocked, done or dropped. Dates are
`YYYY-MM-DD`. PR nodes cover open PRs and recent merges; older PR numbers stay on their items'
`prs` lists. Write paths without a leading slash (`project/qa/...`), so the sync leaves them alone.
