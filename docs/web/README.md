# Web app (`apps/web`)

Next.js (App Router) site for attendees and organisers. It never talks to the database:
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
| `FEATURE_EVENT_BANNER`                              | server, at request time | Event pages and browse cards show the organiser's banner unless this is `false`, which shows the template colour instead (design 2 `showBanner`).                      |
| `FEATURE_BOOKING`                                   | server, at request time | `true` turns "Tickets open soon" on event pages into a Get tickets link. Off until booking ships in Sprint 2.                                                          |
| `FEATURE_TICKETS`                                   | server, at request time | `true` turns on the ticket screen at `/tickets/{orderId}` (S2-3). Anything else returns 404 there.                                                                     |
| `WEB_URL`                                           | server, at request time | Public address of the site, used for absolute share-image links in event link previews.                                                                                |
| `REVALIDATE_SECRET`                                 | server, at request time | Bearer secret the api sends to `POST /internal/revalidate`. Unset turns the route off (404).                                                                           |
| `APP_ENV`                                           | server, at request time | Sentry environment for server errors (`development`, `staging`, `production`).                                                                                         |
| `NEXT_PUBLIC_SENTRY_DSN`                            | build time              | Turns Sentry on. Empty keeps it off, which is the default for local dev and tests.                                                                                     |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`             | build time              | Share of requests traced, `0` to `1`. Defaults to `0.1`.                                                                                                               |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | build time only         | Upload source maps to Sentry. Without a token, source maps aren't uploaded.                                                                                            |

## Pages

| Route                                                           | What it does                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                             | Public browse of upcoming published events in Sydney and Melbourne (`GET /public/events`), with deselectable When and Price chips (S1-5, artboard 1).                      |
| `/e/{slug}`                                                     | Public event page and 1200 × 630 Open Graph share image (`GET /public/events/:slug`), served under an enforced per-request nonce CSP (S1-3, artboards 2 and 2b).           |
| `/signup`                                                       | Email-only sign-up, or continue with Google. Signed-in organisers are sent to `/organiser`.                                                                                |
| `/signin`                                                       | The same form with returning-organiser copy.                                                                                                                               |
| `/auth/verify`                                                  | Landing page for the magic link. Exchanges the token and goes to `/organiser`.                                                                                             |
| `/organiser/setup`                                              | Asks a new organiser to name their organisation (`POST /organisations`).                                                                                                   |
| `/organiser`                                                    | Organiser home. Signed out goes to `/signin`; no organisation goes to `/organiser/setup`. With the wizard on, `?view=upcoming` or `?view=drafts` picks the events segment. |
| `/organiser/events/new`                                         | Creates a draft from `?template=` (workshop, gig, school-night, meetup; none means blank) and opens the wizard. Behind `FEATURE_EVENT_WIZARD`.                             |
| `/organiser/events/new/{basics,tickets,details,review}?draft=…` | The create-event wizard. Steps switch without a page load; reopening a draft resumes on its last step.                                                                     |
| `/tickets/{orderId}#key=…`                                      | The confirmation after booking and the attendee's ticket stubs, which work offline after the first visit (S2-3, artboard 4). Behind `FEATURE_TICKETS`.                     |
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
2. **Tickets** (S1-2): edits free ticket types (`src/app/organiser/events/new/TicketsStep.tsx`).
   While `paid_tickets` is off, every ticket card shows "Free ticket. No fees for you or your
   guests." with no Free/Paid toggle (`priceCents` is always `0`). Fields are Ticket name, How many
   tickets? (with ±5 stepper buttons and typed input), Max per order, Sales start (`When I publish`
   or `Pick a date and time`) and Sales end (`At start time`, `1 hour before`, `1 day before`,
   `When the event ends` or `Pick a date and time`). Custom sales start and end times are entered in
   the event's time zone (`src/lib/zoned-time.ts`). When an event has more than one ticket type,
   every type except the one being edited collapses to a summary row (`Free · {n} tickets · up to
{m} per order`) with `Edit` and `Remove {name} ticket`. Changes call
   `POST /organisations/:orgId/events/:id/ticket-types`,
   `PATCH …/ticket-types/:typeId` and `DELETE …/ticket-types/:typeId`, each returning the refreshed
   event with its new `version` so wizard autosave stays in sync.
3. **Details** (`DetailsStep.tsx`, artboard 8b); contact email is required to publish:
   - **About this event**, up to 2,000 characters. It always starts empty. The template only sets
     the placeholder, a few questions to answer (`ABOUT_PROMPTS` in `src/lib/templates.ts`), so
     nothing the organiser didn't write is published as theirs.
   - **Accessibility**: a fieldset of six checkboxes (saved in list order, whatever order they were
     ticked in) and "Anything else people should know?", up to 500 characters.
   - **Cancellations**: any time (the default), up to 24 hours before, or none, with the same
     wording the event page uses.
   - **Contact email for attendees**. It is only for people with a ticket: the public event page
     and its api response carry `hasContactEmail`, never the address, and the page has no `mailto`.
     An empty field visibly prefills the signed-in viewer's own email; an existing saved address
     stays unchanged. The prefill is saved only on blur or Next, never just by opening a draft.
     A mistyped address shows "Enter an email address, like name@example.com" on blur or Next and
     isn't saved until fixed; Next focuses the mistake. Clearing it saves an empty draft value,
     explains that it is needed to publish, and does not silently restore the prefill in this session.
     The api validates the address and refuses publishing without a saved one (SEC-20).

   The two long fields show a count ("168 / 2,000") beside their hint. Screen readers hear "1,832
   characters left" through a polite live region once typing pauses, not on every key.

4. **Review**: the "Needed to publish" checklist (name, date and time, venue, a ticket type and
   saved contact email). The contact row shows "Replies from attendees go to {email}" and Change;
   Add/Change returns to Details with the email field focused. It uses the server-confirmed value,
   and publishing waits for a pending contact save; a failed replacement cannot publish the old address.
   The
   Publish button is never disabled; pressing it with something missing shows "Add … to publish.
   Everything else is ready." and moves focus to the checklist. While a venue lookup or ticket
   edits kept on the phone are still on their way, it sends them first and lets the api say what's
   missing. After `POST /organisations/:orgId/events/:id/publish` the
   "Your event is live" screen shows the link to `/e/{slug}` with copy and share buttons.

Every change autosaves ([ADR 0016](../adr/0016-wizard-autosave-with-versions-and-on-device-drafts.md)):
on blur, every 10 seconds while there are changes, and when the tab is hidden. Offline changes are
kept in IndexedDB and synced when the connection returns, ticket type edits included. The header shows "Draft saved", "Saving…",
"Saved on this phone" when offline (and "Saving…" while a picked venue is still being looked up; moving step, closing and publishing wait for it), or "Couldn't save. We'll keep trying." when the api fails while
online. A field the api refuses (422) keeps its value on screen with the api's message under it, and
the header says "Couldn't save one field. Check the message under it." until it's changed.

The organiser home lists the organisation's events (`GET /organisations/:id/events`) in two
segments, Upcoming (published and not yet ended, soonest first) and Drafts (newest first). It
opens on Drafts when nothing is coming up. Each card has the date, title, a Live or Draft chip,
booked of capacity for live events, and one action: "Open event page", or "Finish setting up",
which returns to the step the draft was left on. The step is saved as soon as it changes.

The organiser header has "View site" and "Sign out" (SEC-16). Sign out calls `POST /auth/sign-out`,
then `clearDeviceDrafts()` whether or not the api answered. Only when the api confirms does it load
`/signin` in full. If the call fails (offline or an error), the session may still be live, so the
page stays put with "We couldn't sign you out. Check your connection and try again." and the button
comes back, rather than looking signed out on a shared computer. The api also sends
`Clear-Site-Data: "storage"`.
`e2e/tests/sign-out.spec.ts` checks that the drafts database is gone, that the old session cookie no
longer signs anyone in, and that a failed call (offline or a 500) keeps the organiser on the page with the alert and still
clears the drafts.

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

Sold out and held are kept apart (DES-10, ARCH-2). Only `soldOut` from the api, true when every
ticket on sale is sold, shows sold out: the bar reads "All tickets taken" (no number; the public api
has no capacity) with a grey "Sold out" label in place of Get tickets, and the price row reads "Sold
out; spots that are released go back on sale here." When `spotsLeft` is 0 but nothing is sold out,
checkout holds have the tickets for now: the bar reads "All taken right now", the price row "All
taken right now. Check back in a few minutes." and Get tickets stays, so checkout can report what's
left.

Organiser text is plain text and is rendered as text only (SEC-3). The map tile is drawn, not a map
provider's tile, and links to Google Maps, which opens the phone's maps app. The link preview image
fetches the api's 1200 × 630 JPEG rendition of the banner (`banner.ogUrl`) itself; with no banner,
or if that fetch fails, it falls back to the template colour.
Its text uses the page's fonts (DES-9): Bricolage Grotesque 800 and Figtree 700, as static WOFF
cuts in `src/fonts` (`*-800-latin.woff`, `*-700-latin.woff`, 42 KB together), because the renderer
can't read WOFF2 or variable fonts. They were made from the site's latin subsets with fontTools
(`fonttools varLib.instancer`, wght 800 and opsz 96 for Bricolage, wght 700 for Figtree), under
the same OFL licences. If a file can't be read, the image falls back to the built-in font.

`e2e/tests/event-page.spec.ts` publishes an event through the wizard, then opens its page in a
fresh browser with no session. It checks the enforced nonce CSP, `private, no-store`, the share
image tag and axe, and that an unknown slug is a 404.

### Caching and revalidation

The page HTML is never cached by anyone: it carries a per-request CSP nonce, so `src/proxy.ts`
sends `Cache-Control: private, no-store`. What is cached is the api read inside Next: the data
cache keeps it for 60 seconds under the tag `event:{slug}` (and `browse` for the public browse list). After the api
publishes an event or commits a change to a live one, it calls `POST /internal/revalidate` on the
web's private address (`WEB_INTERNAL_URL`) with `Authorization: Bearer $REVALIDATE_SECRET` and
`{ "slugs": ["…"] }`. The route compares the secret in constant time, then expires those tags and
`browse` at once, so the next visitor sees the edit.

Next's data cache is per web task. For a plain-HTTP private hostname, the api resolves every
address and POSTs to each in parallel, so the Cloud Map endpoint invalidates every healthy web
task it returns. HTTPS and IP endpoints receive one request; a failed DNS lookup also falls back
to the original endpoint. Missed signals never fail the organiser's save, and affected tasks
catch up when their 60-second cache entry expires.

## Public browse (S1-5)

`/` renders the Discover screen (design artboard 1, `src/app/page.tsx` and `src/app/Browse.tsx`).
The server fetches the initial list from `GET /public/events` (`src/lib/public-events.ts`, cached
for 60 seconds under the `browse` tag) using the URL query parameters (`?city=`, `?when=`,
`?price=`, defaulting to Sydney with no filters).

- **City picker**: `Near Sydney · Change` (or `Near Melbourne · Change`) opens the city group
  (`Sydney`, `Melbourne`). Switching city fetches `/api/public/events` for the chosen city and
  updates the address bar.
- **Filter chips**: `When` (`Tonight`, `This weekend`, `Next 7 days`) and `Price` (`Free`, `Paid`),
  each in a labelled `role="group"` with `aria-pressed` buttons. Each group is single-select and
  deselectable; the page heading follows the active `When` chip (`Coming up near you`, `On tonight`,
  `This weekend`, `Next 7 days`), and a visually hidden `role="status"` announces the result count
  (`{n} event(s)`).
- **Cards**: each card shows the organiser's banner (or the template tint and category word when
  there is no banner or `FEATURE_EVENT_BANNER` is `false`), a `Free` badge when the all-in from
  price is zero, the date eyebrow in the event's time zone, the title, `suburb · venue` (or
  `Online`), and the API's all-in from price (`Free` or `From A$… all-in`, never recomputed in the
  web app). Every card is a single plain `<a href="/e/{slug}">` whose `aria-label` reads all four
  facts; plain anchors ensure clicking a card triggers a full document navigation that loads the
  event page's enforced nonce CSP ([ADR 0018](../adr/0018-enforced-nonce-csp-on-event-pages.md)).
- **Empty state**: when no events match, the page shows `Nothing on for that yet. Try Next 7 days.`

## Ticket screen (S2-3)

`/tickets/{orderId}` is where checkout (S2-2) lands and where the ticket email will link
(`src/app/tickets/[orderId]/TicketScreen.tsx`, design artboard 4). It sits behind
`FEATURE_TICKETS`.

- **Key**: the link carries the order's ticket key in the fragment (`#key=…`), so the server never
  sees it. The page takes it out of the address bar at once with `history.replaceState` and keeps it
  in `sessionStorage` for that tab, so a reload still works. It never goes in `localStorage`, Cache
  Storage or a query string. The order is read with `Authorization: Bearer` from
  `GET /api/public/orders/{orderId}/tickets`.
- **Straight after checkout**: checkout calls `stashConfirmedOrder(createdOrder)` before it goes to
  `confirmationPath(orderId, ticketKey)`. The page shows that order at once with no loading state,
  then forgets it. The stashed copy never holds the key.
- **Loading from a link**: a grey stub with `aria-busy` and a visually hidden "Loading your
  tickets". No spinner.
- **Confirmation**: "You're going!" and "We've also emailed your tickets to {email}".
- **Stubs**: one ticket at a time: date eyebrow, event, venue (online: "Online · the link is in your
  email"), a QR, name, ticket type and ref (shown as `K7Q4-M2XA`), then "Turn your screen brightness
  up at the door so it scans first time." With several tickets, Previous and Next round buttons and
  a sideways swipe on a touch screen move between them, and "Ticket 1 of 2" is announced politely.
  At either end the button stays focusable with `aria-disabled`. One ticket has no pager and is
  labelled "Your ticket". A revoked ticket shows "This ticket is no longer valid." with the
  organiser to contact, and no QR or brightness note. If every ticket is revoked, the heading is "Your
  tickets", with no email line or Add to calendar. A QR still being signed shows "Getting your QR
  code ready…" as a status, and the page reads the order again every 2 seconds, up to 5 times. If it
  still hasn't arrived, the stub says it's taking longer than usual and is in the ticket email too.
- **QR**: drawn in the browser as an inline SVG from the ticket's signed token
  (`src/components/QrCode.tsx`, using `qrcode-generator`, level M, four-module quiet zone) on a
  full-white card. While a QR shows, Screen Wake Lock keeps the screen on where the browser allows,
  and the lock is asked for again when the tab comes back.
- **Offline**: the page registers `public/tickets-sw.js` with scope `/tickets/`, then saves the
  order, its own HTML and the built files it loaded into Cache Storage. "Works offline" shows once
  all of that and every QR is in. With no signal the worker answers from that cache
  ([ADR 0020](../adr/0020-ticket-screen-offline-with-a-scoped-service-worker.md)).
- **Saved copy**: the page always asks the api first (with no key header if it has no key). The
  copy saved on the phone shows only when that request fails. A refused link never shows it, and a
  refused keyed link deletes it.
- **Remove and expiry** (S2-4a): whenever the order is saved on the device (even if the rest of
  the save failed), "Remove tickets from this device"
  appears under Find more events. It opens an inline confirm card. "Remove" deletes the order's
  saved copy, its page, and the tab's key and stashed order, with or without signal. With no other
  order saved, it also deletes the cache and unregisters the worker. The page then shows "Removed
  from this device." in place of the tickets. If storage is blocked, the card says it couldn't remove them
  and the tickets stay. A saved order is never served after 7 days past its
  event's end, by the page or the worker. It is dropped on the next visit or when the worker starts.
- **Errors**: no signal and nothing saved shows "We couldn't load your tickets." with Try again. A
  missing, wrong or expired key shows "That link doesn't work any more."
- **Add to calendar**: a menu, a bottom sheet under 640 px and a popover above, with "Apple Calendar
  or Outlook" (an `.ics` download) and "Google Calendar". Esc or a tap outside closes it and focus
  returns to the button. The calendar entry links the public event page, never the ticket page. The
  wallet button and the "My tickets" link stay hidden until those stories land.
- **Contract**: the order types in `src/lib/tickets.ts` copy the orders contract the BackendDev is
  adding to `@onetickets/shared` in #58, and move there once it merges. Until then, e2e answers the
  one read from a fake order (`e2e/tests/tickets.spec.ts`).

## How the browser reaches the api

The browser only calls `/api/*` on the web origin. `next.config.ts` rewrites those to `API_URL`, so the
session cookie stays first-party and the api needs no CORS. Next forwards `Origin` and any incoming
`X-Forwarded-For` unchanged. Nothing is stored in `localStorage`. The device keeps two things:
unsynced wizard edits in IndexedDB, and the attendee's own ticket screen in Cache Storage (ADR 0020).
Wizard edits are tied to the signed-in organiser. They are wiped when
someone else opens the wizard or the organiser signs out, and they expire after 7 days (ADR 0016).

## Security headers

`apps/web/src/lib/security-headers.ts` sets these on every page:

- `Content-Security-Policy-Report-Only` (report-only until Next's inline scripts get nonces)
- On `/e/{slug}` only, an enforced `Content-Security-Policy` with a per-request script nonce
  ([ADR 0018](../adr/0018-enforced-nonce-csp-on-event-pages.md))
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Permissions-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`, and `no-referrer` on `/auth/verify` and
  `/tickets/*`

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
