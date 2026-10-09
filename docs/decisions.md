# Decisions

Product and engineering decisions that shape the code, newest first. Add a row when a decision
changes how people build. Longer reasoning can go in its own file under `docs/decisions/`.

| Date       | Decision                                                                                                        | Why                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2026-10-09 | No LocalStack. Local dev uses Docker Postgres, a local mail inbox and a local signing key. No dev AWS account   | LocalStack's free tier is non-commercial and lacks RDS, ECS and current SES |
| 2026-10-09 | Run locally with Docker for now; set up staging and AWS later                                                   | Nothing needs a shared environment yet; saves cost                          |
| 2026-10-09 | Scale down staging: minimal, Spot capacity, no NAT, off out of hours                                            | Cost                                                                        |
| 2026-10-08 | Sign-in asks for email only; new accounts give the organiser name after the magic link                          | Avoids revealing which emails have accounts                                 |
| 2026-10-08 | Organisation data fenced by Postgres row-level security as a non-superuser app role, tenant set per transaction | A missed check in code still can't leak another organiser's data            |
| 2026-10-08 | Modular monolith: one NestJS api with modules that own their schema and expose only `index.ts`                  | Simple to run and deploy; boundaries enforced by dependency-cruiser         |
| 2026-10-08 | Money in integer cents; one pricing function                                                                    | No rounding errors; one place for fees and GST                              |
| 2026-10-08 | Stripe charges use `on_behalf_of` so the organiser is the seller (fold into S4-3)                               | The platform should not be merchant of record                               |
| 2026-10-08 | Free tickets and QR check-in ship before paid checkout                                                          | Real events can run on OneTickets sooner, with less risk                    |
| 2026-10-08 | Light Agile: two-week sprints, Kanban board, demo to real organisers each sprint                                | Fast feedback from the people who will use it                               |
| 2026-10-08 | pnpm workspace monorepo: web, api, scanner and shared package                                                   | One repo, shared types between front and back end                           |
