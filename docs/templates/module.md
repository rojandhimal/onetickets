# <Module or app name>

Copy to `docs/backend/<module>.md` for an api module, or `docs/<app>/README.md` for an app.
Delete any section that doesn't apply.

One paragraph: what this module is for and who uses it.

## Responsibilities

- What it owns (tables, schema, flows).
- What it deliberately does not do, and which module does instead.

## Public surface

What other code may use, exported from `index.ts`:

| Export | What it does |
| ------ | ------------ |

## HTTP endpoints

| Method and path | Who may call it | What it does |
| --------------- | --------------- | ------------ |

Request and response schemas: `packages/shared/src/api/<module>.ts`.

## Data

Schema `<name>`. Tables, key columns, constraints and row-level security policies. Name any
invariant the database enforces (for example `sold + held <= capacity`) and the test that tries
to break it.

## Configuration

| Variable | Required | Local value | What it does |
| -------- | -------- | ----------- | ------------ |

## How to run and test it locally

Commands, seed data, and how to see it working.

## Decisions

Links to the ADRs that shaped this module.

## Known limits and follow-ups

What isn't built yet, with story ids.
