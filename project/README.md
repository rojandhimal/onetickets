# Project files

The team's working files, readable by any AI tool or person:

| Folder                | What's in it                                                     |
| --------------------- | ---------------------------------------------------------------- |
| [pm](pm/board.md)     | Sprint board, owner setup list, working agreement, progress logs |
| [design](design/)     | Design handoffs per sprint and the UX copy sheet                 |
| [qa](qa/)             | Test strategy, sprint checklists and acceptance notes            |
| [research](research/) | Discovery interview guide, recruitment pack, usability test plan |
| [social](social/)     | Voice and tone, draft posts                                      |

Claude project threads work in a shared project folder. Agents in other tools edit these files
directly in their pull requests. PM keeps both copies in step with
`node scripts/sync-project-files.mjs`:

- A file changed on one side only is copied to the other.
- A file changed on both sides is merged against `project/` as of the last sync. Progress logs keep
  both sides' entries. Anything else that can't merge is reported for PM to merge by hand.
- After merging a conflicted file by hand in `project/`, run the script again with `--prefer-repo`
  to copy that version to the shared folder.
- `.sync-state.json` records what each side looked like at the last sync. Commit it with the files.
- Deletes don't sync. A file deleted on one side comes back on the next run, so delete it on both.
- If both sides edit the same line of a progress log, both versions are kept. Remove the duplicate
  by hand.

Security docs live in [docs/security](../docs/security/).
