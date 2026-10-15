# Project files

The team's working files, readable by any AI tool or person:

| Folder                | What's in it                                                     |
| --------------------- | ---------------------------------------------------------------- |
| [pm](pm/board.md)     | Sprint board, owner setup list, working agreement, progress logs |
| [design](design/)     | Design handoffs per sprint and the UX copy sheet                 |
| [qa](qa/)             | Test strategy, sprint checklists and acceptance notes            |
| [research](research/) | Discovery interview guide, recruitment pack, usability test plan |
| [social](social/)     | Voice and tone, draft posts                                      |

Claude project threads work in a shared project folder, and PM copies it here with
`scripts/sync-project-files.sh`. Agents in other tools edit these files directly in their pull
requests; PM copies those changes back. Security docs live in [docs/security](../docs/security/).
