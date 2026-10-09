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

| Variable               | Where it's read         | What it does                                                                                                  |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `API_URL`              | build time and server   | Where Next forwards `/api/*` and where server components call the api. Baked into the rewrites at build time. |
| `FEATURE_EVENT_WIZARD` | server, at request time | `true` makes the event templates on `/organiser` into links. Anything else shows them as "Coming soon".       |

## Pages

| Route              | What it does                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `/`                | Redirects to `/signup` for now.                                                             |
| `/signup`          | Email-only sign-up, or continue with Google. Signed-in organisers are sent to `/organiser`. |
| `/signin`          | The same form with returning-organiser copy.                                                |
| `/auth/verify`     | Landing page for the magic link. Exchanges the token and goes to `/organiser`.              |
| `/organiser/setup` | Asks a new organiser to name their organisation (`POST /organisations`).                    |
| `/organiser`       | Organiser home. Signed out goes to `/signin`; no organisation goes to `/organiser/setup`.   |
| `/healthz`         | Returns `{"status":"ok"}` for the container health check.                                   |

## Sign-in flow

1. The organiser enters their email. The browser calls `POST /api/auth/magic-link` with `{ email }`.
   The screen is the same for new and returning organisers ([ADR 0002](../adr/0002-email-first-sign-in.md)).
2. The email links to `/auth/verify#token=…`. The page reads the token from the fragment, clears it from
   the address bar and exchanges it with `POST /api/auth/magic-link/verify`
   ([ADR 0001](../adr/0001-magic-link-token-in-url-fragment.md)). The api sets an HttpOnly session cookie.
3. `/organiser` calls `GET /me` on the server with that cookie. An organiser with no organisation is sent
   to `/organiser/setup` first.

Google sign-in starts at `/api/auth/google/start`. When it fails, the api redirects back to `/signup`
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
