# Attendee ticket access (SEC-4)

SEC-4 is the backend foundation for S2-4. It extends identity (credentials and sessions)
and checkout (ticket reads), behind the default-off runtime `FEATURE_ATTENDEE_TICKETS`
flag. **Keep it off until S2-4 supplies the request form, fragment-clearing redemption
page and My tickets portal.** There is no attendee web flow in this PR.

## API contract

The browser uses the web origin's `/api` rewrite. Responses are `no-store` and
`Referrer-Policy: no-referrer`, including errors. Writes require JSON and the configured
web Origin, as organiser sign-in does. Schemas and DTOs live in
`packages/shared/src/api/attendee.ts`.

| Method and path                         | Request                                     | Response                                            |
| --------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| POST `/attendee/magic-link`             | `{email, turnstileToken?}`                  | 202, empty body                                     |
| POST `/attendee/magic-link/verify`      | `{token}`                                   | 200 `AttendeeSession` and attendee cookie           |
| GET `/attendee/session`                 | attendee cookie                             | 200 `AttendeeSession`                               |
| POST `/attendee/sign-out`               | JSON `{}` and optional attendee cookie      | 204, revoke and clear cookie; clear site storage    |
| GET `/attendee/orders?after=<uuid>`     | attendee cookie; optional pagination cursor | 200 `{orders: OrderTicketsDto[], nextCursor: string | null}` |
| GET `/attendee/orders/:orderId/tickets` | attendee cookie                             | 200 `OrderTicketsDto`                               |

`AttendeeSession` is `{email, expiresAt, permissions: ['tickets:read']}`. It is never an
organiser identity. No response issues order bearer keys. Lists return up to 100 orders
in stable UUID order; follow `nextCursor` until null, then sort/group for presentation.
A cursor does not confer access. Unknown and foreign orders both return 404.
Missing/expired/revoked attendee sessions return 401; invalid, used, superseded or expired
links return the same 410. Malformed input is 422, valid requests while disabled 404,
rate limits 429. Organiser cookies cannot substitute for attendee cookies or vice versa.

## Credentials, scope and data

The emailed URL is `WEB_URL/my-tickets/verify#token=<random-token>`. Tokens have 256 random
bits, are stored as SHA-256 hashes, expire in 15 minutes and work once. An email-scoped
transaction lock serialises new requests so only the latest issued link remains valid.
Issuance and delivery are separate: messages can arrive out of order; a failed send can
supersede a previous link, so request a new one. No background resend worker is added.

Every valid email takes the same issuance and delivery path, even if it has no orders.
There is no unauthenticated buyer lookup. Requests neither create organiser users nor
memberships. Mail errors return a fixed 503 without logging the transport exception.
Confidential mail is omitted from the console transport; use SMTP/Mailpit to inspect it.

The dedicated `__Host-ot_attendee` cookie is Secure, HttpOnly, SameSite=Lax and Path=/.
Local HTTP uses `ot_attendee` under the existing secure-cookie configuration guard.
Sessions follow platform defaults: 7 days idle and 30 days absolute; the 15-minute limit
applies to the emailed link. Successful exchange atomically consumes the link, revokes
this browser's previous attendee session and starts a fresh session. Organiser sessions
remain independent. Sign-out revokes the attendee session server-side.

Migration 0012 adds FORCE-RLS `identity.attendee_links` and `identity.attendee_sessions`.
Like existing auth tables, the app resolves credentials by hash; updates are limited
to consumption/revocation/last-seen columns. The worker has select/delete for SEC-9 cleanup.
The email is personal data used to bind ticket access. Cleanup scheduling and retention
of spent/expired credentials remain SEC-9's pre-launch work. No new personal data is logged.

After validating the session, reads use `app.attendee_email` in a transaction. It has
SELECT-only policies for matching orders and their tickets. The unit of work clears that
scope on every transaction/scope change. It never sets `app.order_id`, which also permits
issuing/signing. Existing order-specific links remain valid until event end plus seven
days; they do not grant email-wide access. No release/refund/update endpoint is added.

## Limits and configuration

- `FEATURE_ATTENDEE_TICKETS=true` enables backend endpoints at runtime; default false.
- Existing `WEB_URL`, `SESSION_COOKIE_SECURE`, `MAIL_TRANSPORT`, SMTP/SES settings apply.
- Requests: 5 per normalised email and 30 per trusted client IP per 15 minutes.
- Redemption: 30 attempts per trusted client IP per 15 minutes.
- Shares the existing rolling `MAGIC_LINK_HOURLY_CAP` budget (default 300) and alarm
  message with organiser sign-in. Request and cap counters use no raw personal data.
- When configured, the existing Turnstile verifier must pass before issuing/sending.
  Keep `TRUST_PROXY_HOPS` correct; 0 locally. No additional paid provider is introduced.

For a local API-only check, use Docker/Postgres and Mailpit as described in
[local development](../local-development.md), temporarily enable the flag, request a
link for a fake `example.test` address, and POST the fragment token to verify. Never
paste credentials in terminal history, logs, issue comments or a query string. The
integration suite exercises this through an in-memory outbox without exposing tokens.
Run `pnpm test:integration` against a disposable database with a non-superuser migration
owner and the normal RLS app role. Disable the flag to roll back the API surface;
schema migration is additive and existing order access is unaffected.

## Frontend handoff and review gates

Author-side FrontendDev contract assessment agreed the separate endpoints/cookie for
S2-4. Its implementation must read the fragment, immediately remove it with
`history.replaceState`, POST it once (including under React Strict Mode), and redirect
to `/my-tickets`. Never put credentials into browser storage, query strings, analytics,
error messages or redirect parameters. `/my-tickets/:path*` reserves `no-referrer` and
private headers, and runtime gating must also cover its server pages. Browser validation
of token removal and the complete portal stays with S2-4, so QA row 4.3 is not fully
accepted by this backend PR alone.

Ticket release needs its own authorisation design: this session is explicitly read-only.
Do not attach write permission to it implicitly. Confirmation-email links continue to
open one order; converting them to email-wide links also belongs to the S2-4 handoff.
Independent QA, Security and ProductDesign reviews remain required before merge.

## Validation evidence

The feature adds 23 PostgreSQL integration cases and an attendee credential/log privacy
case, plus focused unit/header tests. The full suite covers 184 integration tests;
364 application unit tests, 16 state-script tests and 56 browser/axe/CSP regression tests
also pass. Browser tests used temporary port-only overrides (3100/3101) and an isolated
database while the user's development services stayed running; the overrides were restored.

Seventeen mutation probes deliberately removed link expiry/replay, session expiry/idle/
revocation/rotation, scope clearing, feature gating, each send/redemption cap,
confidential mail and the order/ticket read/write fences. Each corresponding test failed;
all source and database policies were restored before validation. A real HTTP log test
also caught and fixed wildcard middleware path handling for the privacy headers.
These are author-side checks, not independent QA/Security approval or S2-4 acceptance.
