# Web app (`apps/web`)

Next.js (App Router) site for organisers and, later, attendees. It never talks to the database:
every read and write goes through the api.

## Run it locally

```sh
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @onetickets/shared build
pnpm --filter @onetickets/web dev          # http://localhost:3000
```

The api must be running on `API_URL` for sign-up to work. Without it, sign-up shows
"We couldn't send the link" and `/organiser` shows its error page.

## Environment variables

| Variable                                            | Where it's read         | What it does                                                                                                  |
| --------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `API_URL`                                           | build time and server   | Where Next forwards `/api/*` and where server components call the api. Baked into the rewrites at build time. |
| `FEATURE_EVENT_WIZARD`                              | server, at request time | `true` makes the event templates on `/organiser` into links. Anything else shows them as "Coming soon".       |
| `APP_ENV`                                           | server, at request time | Sentry environment for server errors (`development`, `staging`, `production`).                                |
| `NEXT_PUBLIC_SENTRY_DSN`                            | build time              | Turns Sentry on. Empty keeps it off, which is the default for local dev and tests.                            |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`             | build time              | Share of requests traced, `0` to `1`. Defaults to `0.1`.                                                      |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | build time only         | Upload source maps to Sentry. Without a token, source maps aren't uploaded.                                   |

## Pages

| Route              | What it does                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `/`                | Redirects to `/signup` for now.                                                             |
| `/signup`          | Email-only sign-up, or continue with Google. Signed-in organisers are sent to `/organiser`. |
| `/signin`          | The same form with returning-organiser copy.                                                |
| `/auth/verify`     | Landing page for the magic link. Exchanges the token and goes to `/organiser`.              |
| `/organiser/setup` | Asks a new organiser to name their organisation (`POST /organisations`).                    |
| `/organiser`       | Organiser home. Signed out goes to `/signin`; no organisation goes to `/organiser/setup`.   |
| `/csp-report`      | Receives CSP violation reports, scrubs them and forwards them to Sentry.                    |
| `/healthz`         | Returns `{"status":"ok"}` for the container health check.                                   |

## Sign-in flow

1. The organiser enters their email. The browser calls `POST /api/auth/magic-link` with `{ email }`.
   The screen is the same for new and returning organisers ([ADR 0002](../adr/0002-email-first-sign-in.md)).
2. The email links to `/auth/verify#token=…`. The page reads the token from the fragment, clears it from
   the address bar and exchanges it with `POST /api/auth/magic-link/verify`
   ([ADR 0001](../adr/0001-magic-link-token-in-url-fragment.md)). The api sets an HttpOnly session cookie.
3. `/organiser` calls `GET /me` on the server with that cookie. An organiser with no organisation is sent
   to `/organiser/setup` first.

Google sign-in starts at `/api/auth/google/start` and returns to `/organiser`. When it fails, the api redirects back to `/signin`
with `?error=google`, `google_unverified` or `google_unavailable`, and the form shows the matching message.

The agreed request and response shapes are in `apps/web/src/lib/contract.ts`.

## How the browser reaches the api

The browser only calls `/api/*` on the web origin. `next.config.ts` rewrites those to `API_URL`, so the
session cookie stays first-party and the api needs no CORS. Next forwards `Origin` and any incoming
`X-Forwarded-For` unchanged. Nothing is stored in `localStorage`.

## Security headers

`apps/web/src/lib/security-headers.ts` sets these on every page:

- `Content-Security-Policy-Report-Only` (report-only until Next's inline scripts get nonces)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Permissions-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`, and `no-referrer` on `/auth/verify`

## Error tracking (Sentry)

Sentry starts in `src/instrumentation.ts` (server) and `src/instrumentation-client.ts` (browser), with
options from `src/lib/sentry-scrub.ts`. It is off unless `NEXT_PUBLIC_SENTRY_DSN` is set. Session
replay is not enabled.

Every event, span and breadcrumb is scrubbed in the app before it is sent
([ADR 0003](../adr/0003-scrub-sentry-events-in-the-app.md)):

- Only the request method and the URL without its query string are kept. Cookies, headers and bodies
  are never collected, and the client IP is not inferred.
- The user is identified by id only, with the organisation id as a tag. No email or name.
- Values pass through `redact()` from `@onetickets/shared`. It masks keys that name a token, secret,
  password, cookie, session, recovery code, MFA code or email, and scrubs bearer tokens, magic-link and
  OAuth parameters, Stripe keys, emails and Australian phone numbers out of strings. The scrubbers
  themselves are in `@onetickets/shared` too, so the api scrubs the same way.

The environment comes from `APP_ENV` on the server and from the hostname in the browser
(`dev.<domain>`, `staging.<domain>`, `<domain>`), so one image is promoted across environments.
When a DSN is set, the report-only CSP sends violation reports to `/csp-report`. That route keeps
only the path of each URL in the report, redacts the rest and forwards it to Sentry's security
endpoint from the server.

### Sentry project setup

Sentry's own scrubbing is the second layer behind the app's, so every Sentry project (one per app)
must have these before its DSN is used:

1. Settings > Security & Privacy: turn on **Data Scrubber** and **Use Default Scrubbers**.
2. Same page: turn on **Prevent Storing of IP Addresses**.
3. Same page, **Additional Sensitive Fields**: add `token`, `code`, `state` and `email`.
4. Only then put the DSN in the `SENTRY_WEB_DSN` repository variable (see `infra/README.md`).

## Design system

Colours, type, radii and the focus ring are CSS variables in `src/app/globals.css`, taken from the
Ticket stub design system. Shared screen pieces (header, notices, buttons) are in
`src/components/screen.module.css`. Fonts (Bricolage Grotesque and Figtree, OFL) are self-hosted in
`src/fonts/` so builds don't need network access.

Every screen is built to WCAG 2.2 AA: 44 px tap targets, one visible focus ring, layouts that work at
375 px, and reduced motion respected.

## Tests

```sh
pnpm --filter @onetickets/web test
```

Unit and component tests use Vitest, jsdom and Testing Library, next to the code they test.
