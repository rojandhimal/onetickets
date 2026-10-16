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

| Variable                                            | Where it's read         | What it does                                                                                                                                                           |
| --------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL`                                           | build time and server   | Where Next forwards `/api/*` and where server components call the api. Baked into the rewrites at build time.                                                          |
| `FEATURE_EVENT_WIZARD`                              | server, at request time | `true` turns on the create-event wizard and makes the templates on `/organiser` into links. Anything else shows them as "Coming soon" and the wizard pages return 404. |
| `FEATURE_EVENT_BANNER`                              | server, at request time | Event pages show the organiser's banner unless this is `false`, which shows the template colour instead (design 2 `showBanner`).                                       |
| `FEATURE_BOOKING`                                   | server, at request time | `true` turns "Tickets open soon" on event pages into a Get tickets link. Off until booking ships in Sprint 2.                                                          |
| `WEB_URL`                                           | server, at request time | Public address of the site, used for absolute share-image links in event link previews.                                                                                |
| `REVALIDATE_SECRET`                                 | server, at request time | Bearer secret the api sends to `POST /internal/revalidate`. Unset turns the route off (404).                                                                           |
| `APP_ENV`                                           | server, at request time | Sentry environment for server errors (`development`, `staging`, `production`).                                                                                         |
| `NEXT_PUBLIC_SENTRY_DSN`                            | build time              | Turns Sentry on. Empty keeps it off, which is the default for local dev and tests.                                                                                     |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`             | build time              | Share of requests traced, `0` to `1`. Defaults to `0.1`.                                                                                                               |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | build time only         | Upload source maps to Sentry. Without a token, source maps aren't uploaded.                                                                                            |

## Pages

| Route                                                           | What it does                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                             | Redirects to `/signup` for now.                                                                                                                                            |
| `/signup`                                                       | Email-only sign-up, or continue with Google. Signed-in organisers are sent to `/organiser`.                                                                                |
| `/signin`                                                       | The same form with returning-organiser copy.                                                                                                                               |
| `/auth/verify`                                                  | Landing page for the magic link. Exchanges the token and goes to `/organiser`.                                                                                             |
| `/organiser/setup`                                              | Asks a new organiser to name their organisation (`POST /organisations`).                                                                                                   |
| `/organiser`                                                    | Organiser home. Signed out goes to `/signin`; no organisation goes to `/organiser/setup`. With the wizard on, `?view=upcoming` or `?view=drafts` picks the events segment. |
| `/organiser/events/new`                                         | Creates a draft from `?template=` (workshop, gig, school-night, meetup; none means blank) and opens the wizard. Behind `FEATURE_EVENT_WIZARD`.                             |
| `/organiser/events/new/{basics,tickets,details,review}?draft=…` | The create-event wizard. Steps switch without a page load; reopening a draft resumes on its last step.                                                                     |
| `/csp-report`                                                   | Receives CSP violation reports, scrubs them and forwards them to Sentry.                                                                                                   |
| `/healthz`                                                      | Returns `{"status":"ok"}` for the container health check.                                                                                                                  |

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

The request and response shapes are in `packages/shared/src/api/auth.ts`, shared with the api; the endpoints are documented in [docs/api/auth.md](../api/auth.md).

## Create-event wizard (S1-1)

The organiser home's template rows open `/organiser/events/new?template=…`, which creates the draft
from the browser (`POST /organisations/:id/events`) so a link prefetch can never create one. The
wizard then lives on `/organiser/events/new/{step}?draft=…`:

1. **Basics**: a banner image, the name, date, start and end time (an end before the start means
   the next day; an end equal to the start is an error), and
   either a venue picked from the address lookup (`GET /places/search`, then `GET /places/:id`) or an
   https link for online events. Times are entered in the event's time zone and sent as ISO 8601 with
   the offset (`src/lib/zoned-time.ts`). The banner is sent as the raw file to
   `PUT …/events/:id/banner` (JPG, PNG or WebP up to 10 MB, checked in the browser first; iPhones
   hand over a JPEG copy of HEIC photos). "Adjust crop" sets the vertical focal point, previewed at
   the widest event page crop, and saves it as `bannerFocus` through autosave. Remove calls
   `DELETE …/banner`. Both return the event with a new `version`, which autosave takes over.
2. **Tickets**: shows the template's free ticket type. Editing arrives with S1-2.
3. **Details**: placeholder until S1-4 (About, accessibility, cancellations, contact email).
4. **Review**: the "Needed to publish" checklist (name, date and time, venue, a ticket type). The
   Publish button is never disabled; pressing it with something missing shows "Add … to publish.
   Everything else is ready." and moves focus to the checklist. After `POST /organisations/:orgId/events/:id/publish` the
   "Your event is live" screen shows the link to `/e/{slug}` with copy and share buttons.

Every change autosaves ([ADR 0016](../adr/0016-wizard-autosave-with-versions-and-on-device-drafts.md)):
on blur, every 10 seconds while there are changes, and when the tab is hidden. Offline changes are
kept in IndexedDB and synced when the connection returns. The header shows "Draft saved", "Saving…",
"Saved on this phone" when offline, or "Couldn't save. We'll keep trying." when the api fails while
online. A field the api refuses (422) keeps its value on screen with the api's message under it, and
the header says "Couldn't save one field. Check the message under it." until it's changed.

The organiser home lists the organisation's events (`GET /organisations/:id/events`) in two
segments, Upcoming (published and not yet ended, soonest first) and Drafts (newest first). It
opens on Drafts when nothing is coming up. Each card has the date, title, a Live or Draft chip,
booked of capacity for live events, and one action: "Open event page", or "Finish setting up",
which returns to the step the draft was left on. The step is saved as soon as it changes.

Pages behind a flag call `connection()` before reading it, so the flag is read per request and a
build made with it off still picks it up when it's turned on.

The wizard's e2e spec (`e2e/tests/wizard.spec.ts`) signs up through the real api and follows the
sign-in link from the api's console mail, which `e2e/playwright.config.ts` keeps in
`e2e/.logs/api.log`. It needs the events api from S1.

Finance and door staff see "Only owners and admins can create events" on the organiser home instead
of the templates, and the wizard pages return 404 for them.

Request and response shapes are in `packages/shared/src/api/events.ts`. The rules behind the checklist
and the stepper ticks are in `src/lib/wizard-model.ts`.

## Event page (S1-3)

`/e/{slug}` renders `GET /public/events/:slug` on the server (`src/lib/public-events.ts`, shared
within a request so the page, its metadata and its share image make one api call). Above the fold at 375 px:
banner, date, title, organiser, then the key facts (price and spots left, venue with a map link,
cancellations, accessibility). The ticket bar sticks to the bottom on phones and becomes a card in a
right-hand column from 768 px. Online events never show their link; buyers get it with their ticket.

Organiser text is plain text and is rendered as text only (SEC-3). The map tile is drawn, not a map
provider's tile, and links to Google Maps, which opens the phone's maps app. The link preview image
fetches the api's 1200 × 630 JPEG rendition of the banner (`banner.ogUrl`) itself; with no banner,
or if that fetch fails, it falls back to the template colour.

`e2e/tests/event-page.spec.ts` publishes an event through the wizard, then opens its page in a
fresh browser with no session. It checks the enforced nonce CSP, `private, no-store`, the share
image tag and axe, and that an unknown slug is a 404.

### Caching and revalidation

The page HTML is never cached by anyone: it carries a per-request CSP nonce, so `src/proxy.ts`
sends `Cache-Control: private, no-store`. What is cached is the api read inside Next: the data
cache keeps it for 60 seconds under the tag `event:{slug}` (browse will use `browse`). After the api
publishes an event or commits a change to a live one, it calls `POST /internal/revalidate` on the
web's private address (`WEB_INTERNAL_URL`) with `Authorization: Bearer $REVALIDATE_SECRET` and
`{ "slugs": ["…"] }`. The route compares the secret in constant time, then expires those tags and
`browse` at once, so the next visitor sees the edit.

Next's data cache is per web task. With more than one task, a revalidate call clears only the task
it reaches, and the others catch up when their 60-second copy expires.

## How the browser reaches the api

The browser only calls `/api/*` on the web origin. `next.config.ts` rewrites those to `API_URL`, so the
session cookie stays first-party and the api needs no CORS. Next forwards `Origin` and any incoming
`X-Forwarded-For` unchanged. Nothing is stored in `localStorage`; the only thing kept on the device is
unsynced wizard edits in IndexedDB. Those are tied to the signed-in organiser. They are wiped when
someone else opens the wizard or the organiser signs out, and they expire after 7 days (ADR 0016).

## Security headers

`apps/web/src/lib/security-headers.ts` sets these on every page:

- `Content-Security-Policy-Report-Only` (report-only until Next's inline scripts get nonces)
- On `/e/{slug}` only, an enforced `Content-Security-Policy` with a per-request script nonce
  ([ADR 0018](../adr/0018-enforced-nonce-csp-on-event-pages.md))
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
When a DSN is set, the report-only CSP sends violation reports to `/csp-report`. That route rebuilds
each report from an allowlist of fields, keeps only the scheme, host and path of each URL, and
forwards it to Sentry's security endpoint from the server.

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
