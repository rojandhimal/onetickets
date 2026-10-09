# OneTickets docs

Start with the [README](../README.md). This folder holds everything else.

| Path                                         | What lives there                                                                        | Owner             |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| [local-development.md](local-development.md) | Running the whole app with one command, or developing from source                       | Docs, DevOps      |
| [architecture.md](architecture.md)           | How the apps, modules and database fit together                                         | Docs              |
| [testing.md](testing.md)                     | Test layers, commands and rules                                                         | QA                |
| [environments.md](environments.md)           | Local, CI, staging and production                                                       | DevOps            |
| [roadmap.md](roadmap.md)                     | Sprint plan and where we are                                                            | PM                |
| [adr/](adr/)                                 | Architecture decision records, `NNNN-title.md`                                          | Whoever decides   |
| `api/`                                       | HTTP endpoints, one file per api module                                                 | BackendDev        |
| `backend/`                                   | How each api module works inside (data, tenancy, access)                                | BackendDev        |
| `web/`, `scanner/`                           | How each front-end app works (pages, flows, config)                                     | FrontendDev       |
| `runbooks/`                                  | Step-by-step fixes for operational situations                                           | DevOps, on-call   |
| `security/`                                  | Threat model and security checklist                                                     | Security reviewer |
| [templates/](templates/)                     | Templates for a [module doc](templates/module.md) and a [runbook](templates/runbook.md) | Docs              |

Where does my change go?

- New setup step or environment variable: `local-development.md` (and the app's own doc).
- New endpoint: `api/<module>.md`.
- New module or app: a new file from the module template.
- A choice someone will later question: a new ADR.
- Something on-call will need at 2 am: a runbook.

The ownership column says who keeps a file current, not who may edit it. Anyone may fix a mistake.
