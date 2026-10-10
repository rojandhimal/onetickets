# 0014. Local development with Docker; staging later; no LocalStack

- Status: Accepted
- Date: 2026-10-09
- Story: S0-2, DEV-1
- Deciders: tegs; DevOps and PM on LocalStack

## Context

Sprint 0 started early with no AWS account, domain or Google sign-in client yet. Nothing needs a
shared environment until demos to outside organisers, and staging costs money every month. A dev
AWS account was planned; LocalStack was considered as a free stand-in.

## Options considered

- **Dev AWS account.** Real services; ongoing cost and setup before it is needed.
- **LocalStack.** Emulates AWS locally; its free tier is non-commercial and lacks RDS, ECS and
  current SES.
- **Docker for what we run, simple stand-ins for the rest.** Postgres in docker compose, a local
  mail inbox, a local signing key.

## Decision

Run everything locally with Docker for now. No dev AWS account and no LocalStack. Staging and
production on AWS are set up later (ADR 0013), when tegs creates the accounts. The Sprint 0 demo
runs locally.

## Consequences

- US$0 infrastructure cost until staging exists.
- Code must not depend on AWS-only behaviour without a local stand-in (for example, mail and
  signing go through an interface with a local implementation).
- No shared URL for testers or organisers yet; demos run from tegs's machine.
- Revisit before the first outside usability sessions or when nightly e2e against staging is
  needed.
