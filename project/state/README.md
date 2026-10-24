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
node scripts/state.mjs next <agent> <role>  # your unfinished task, or unassigned ready ones
node scripts/state.mjs role <your-role>   # your role's node, what you own, what you review
node scripts/state.mjs show <id>          # one item or PR with everything linked to it
```

`<agent>` is your AI provider in lowercase: `claude`, `codex`, `gemini` and so on. Set
`STATE_BY=<agent>/<role>` (for example `STATE_BY=codex/frontend`) and `next` and `claim` use it
when you leave the arguments out.

No Node? Read `graph.jsonl` directly: one JSON object per line, so `grep '"status":"ready"'` or
`grep '"owner":"backend"'` works too.

The brief says when `main` has moved since the graph was last updated. Then check what merged since
(`git log --oneline <graph main>..origin/main`) before trusting the statuses.

## Taking a task

Every item names the agent working on it in `agent`; no agent means unassigned
([working agreement section 5](../pm/working-agreement.md)). An agent holds **one task at a time per
role**: one item in progress or blocked. Moving it to review or done, or releasing it, frees the
agent for the next.

1. Run `next`. If you hold an unfinished task, carry on with it.
2. Otherwise claim an unassigned ready item: `node scripts/state.mjs claim S2-4 codex`. That sets
   `agent`, `claimed` and `active` to today and moves the item to `in_progress`. It refuses an item
   another agent holds, and a second task while you hold one.
3. Open a draft PR whose title starts with the item id (for example `S2-4: My tickets`), so the
   claim also shows on GitHub. Two teams can be active at once (risk R8).

Any `set` on your item with `STATE_BY=<agent>/<role>` moves `active` to today. The brief lists
claims with no activity for more than 5 days. PM checks their PRs for recent pushes, then releases
them (`node scripts/state.mjs release <id>`, which clears the agent and puts an in-progress item
back to ready) or reassigns them (`set <id> agent=<other>`).

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

Set `STATE_BY` to say who you are (for example `STATE_BY=codex/frontend`). When PM records a merge
with `set meta main=<sha>`, that stamps `STATE_BY` and today's date on the meta node. Edits to other
nodes leave the meta line alone, so PRs from different roles don't conflict on it. Quote a SHA made
only of digits (`main='"2787073"'`), or it is saved as a number. `pnpm lint` runs
`node scripts/state.mjs check`, so CI fails on a broken graph.

Still add your three-line entry to your progress log. The log is the history; the graph is what the
next agent reads.

## Who updates what

| Change                                                | Who                                                     |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Your role node; your item's status, PRs and `waiting` | The role doing the work, in its PR                      |
| Claiming an item (`claim`)                            | The agent taking it, in its draft PR                    |
| Releasing or reassigning an idle claim (`release`)    | PM, after more than 5 days without activity             |
| A PR node's `reviews`                                 | The reviewer, in a PR or through PM                     |
| Merges (`state=merged`, `merged=<sha>`, items done)   | PM after tegs merges, with `meta.main`                  |
| New items, sprints, decisions, risks, priorities      | PM, with tegs for scope, cost or user-visible decisions |

Claude project threads edit the copy in the shared project folder; PM's
`node scripts/sync-project-files.mjs` carries it both ways like the other project files. Changes to
different nodes usually merge cleanly because each node is one line. Two edits to the same node
are a conflict for PM to settle. Edits to neighbouring lines, or two PRs that both add nodes at the
end, can also conflict: keep both sides' lines, then run `node scripts/state.mjs check`.

## Node types

Every line has `type` and a unique `id`. Fields that name another node are the graph's edges.

| Type       | Id                                     | Required fields                            | Edges and other fields                                                                                                                              |
| ---------- | -------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta`     | `meta`                                 | `updated`, `by`, `main`, `sprint`, `phase` | `sprint` names the current sprint; `main` is the main commit the graph matches                                                                      |
| `sprint`   | `S0` to `S10`                          | `name`, `status`                           | `status`: planned, in_progress, done; `accepted`, `evidence`                                                                                        |
| `role`     | `pm`, `backend`, …, `tegs`             | `name`, `now`, `next`, `blocked`           | `tool` last used, `brief`, `log`                                                                                                                    |
| `item`     | story or card id, e.g. `S2-2`, `SEC-6` | `title`, `status`, `owner`                 | `owner` → role; `deps` → items; `reviewers` → roles; `sprint` → sprint; `prs` → PR numbers; `agent`, `claimed`, `active`; `waiting`, `spec`, `note` |
| `pr`       | `#54`                                  | `title`, `state`, `branch`                 | `item` → item; `author` → role; `reviews` as `{role: "pass@sha"}`; `head`, `merged`, `ci`, `tool`                                                   |
| `decision` | `D01`, `D02`, …                        | `date`, `text`, `by`                       |                                                                                                                                                     |
| `risk`     | `R1`, `R2`, …                          | `text`, `owner`, `status`                  | `status`: open, closed; `action`                                                                                                                    |

Item `status` is one of backlog, ready, in_progress, review, blocked, done or dropped. Dates are
`YYYY-MM-DD`. PR nodes cover open PRs and recent merges; older PR numbers stay on their items'
`prs` lists. Write paths without a leading slash (`project/qa/...`), so the sync leaves them alone.
