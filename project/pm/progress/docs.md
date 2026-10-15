# Progress: docs

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-09 (evening)

- **Done:** PR #8 passed QA re-check, CI green, no conflicts. ADR numbers settled with PM (FrontendDev 0001-0003, BackendDev 0004 and 0015, docs 0005-0014, next free 0016). local-development.md now links DevOps's run-locally.md (#11); two pages for two readers, agreed with PM
- **Next:** after merge, add links for ADRs 0001-0004 and 0015 once #9 and #10 land
- **Blocked:** waiting on tegs to merge #7 then #8

## 2026-10-09

- **Done:** README rewrite and docs/ (local development, architecture, testing, environments, roadmap), CONTRIBUTING.md, PR template with "Docs updated", templates for ADR, module doc and runbook, ADR index and ADRs 0005 to 0014. All in [PR #8](https://github.com/rojandhimal/onetickets/pull/8). ADR numbers 0001 to 0003 reserved for FrontendDev, 0004 for BackendDev
- **Next:** drive PR #8 to green; fold DevOps's one-command Docker guide into docs/local-development.md when it lands
- **Blocked:** nothing. PR #7 (security docs) should merge before #8 so its checklist links resolve

## 2026-10-09 (late)

- #7 and #10 merged. tegs merged main into #8. I pushed 463480d on top, which:
  - links ADRs 0004 and 0015
  - restores the `docker compose up -d postgres mailpit` dev line and the MFA_ENCRYPTION_KEY step
  - marks S0-3 as done in the docs
- Waiting on CI for 463480d. #9 still needs to merge for docs/web/README.md and ADRs 0001–0003.
- #8 merged (463480d, all checks green). FrontendDev will link ADRs 0001–0003 in docs/adr/README.md as part of #9. Docs work is done.
- #9 merged; FrontendDev's #12 links ADRs 0001–0003 in the index.
