# api logs, errors and traces

## Logs

The api logs one JSON line per event to stdout with [pino](https://getpino.io) (`nestjs-pino`). Options
live in `apps/api/src/observability/logging.ts`.

Every line carries:

| Field            | Where it comes from                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service`        | Always `api`.                                                                                                                                                        |
| `environment`    | `APP_ENV` (`development` if unset).                                                                                                                                  |
| `requestId`      | The caller's `x-request-id` when it is 8 to 64 characters of letters, digits, `.`, `_` or `-`; otherwise a new UUID. It is echoed back in the `x-request-id` header. |
| `userId`         | Added once the session is checked, for signed-in requests.                                                                                                           |
| `organisationId` | Added once the caller's role in the organisation is checked.                                                                                                         |

A completion line is logged for each request except `/health/*`. It keeps the method, the path without
its query string, the status code and the response time. Headers, cookies, bodies and client IPs are
never logged.

Personal data is masked before a line is written: object fields go through `redact()` and string
arguments through `redactString()`, the same functions the web app uses (`@onetickets/shared`). Emails,
phone numbers, tokens and similar values come out as `[redacted]`.

Locally `MAIL_TRANSPORT=console` prints whole emails, sign-in links included, straight to stderr rather
than through the logger, so you can click them. It is refused in production.

`LOG_LEVEL` sets the level (`info` by default; `debug` for more).

Application logs are kept 30 days in staging and 90 days in production (CloudWatch, set by DevOps). The
audit log is not in these logs: it lives in `identity.audit_events` in Postgres, and its 1-year retention
is a database job (SEC-9).

## Errors and traces (Sentry)

Sentry is loaded before anything else with `node --import ./dist/instrument.js dist/main.js` (the
`start` script and the Docker image both do this; ESM needs the flag). Options are in
`apps/api/src/observability/sentry.ts`. It is off unless `SENTRY_DSN` is set.

- Unhandled errors are reported by Nest's `SentryGlobalFilter`, tagged with `environment` (`APP_ENV`) and
  `release` (`SENTRY_RELEASE`, the git SHA in deployments).
- Traces use OpenTelemetry underneath. A request from the web app carries `sentry-trace` and `baggage`,
  so one trace runs from the browser through Next.js to the api and every Postgres query it makes.
  `SENTRY_TRACES_SAMPLE_RATE` sets the share traced (`0.1` by default).
- Every event, breadcrumb and span goes through the shared scrubbers (`scrubEvent`, `scrubBreadcrumb`,
  `scrubSpan`) before it leaves the process ([ADR 0003](../adr/0003-scrub-sentry-events-in-the-app.md)).
  User info, cookies, headers, bodies and query strings are never collected. Database spans keep the
  query text with parameters as placeholders, and the connection string without credentials.

### Checking Sentry in an environment

Set `SENTRY_TEST_ROUTE=on` and call `GET /health/sentry-test`. It throws a test error that should appear
in Sentry with the right environment and release. Without the variable the route returns 404. Turn it
off again afterwards.
