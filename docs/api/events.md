# Events and ticket types API

Module: `apps/api/src/modules/catalogue`. Contracts: `packages/shared/src/api/events.ts`.
Decision record: [ADR 0017](../adr/0017-public-event-reads-and-plain-text-descriptions.md).

Errors use `ApiErrorBody` (`{ statusCode, code, message, field? }`), plus the extra fields noted
below. Switch on `code`, not on the message.

## Organiser routes

All need a session and a membership with `manageEvents` (owners and admins). The path's
organisation decides what the caller can see: another organisation's event is `404
event_not_found`, the same as one that does not exist.

| Method and path                                   | Body                          | Success             |
| ------------------------------------------------- | ----------------------------- | ------------------- |
| `POST /organisations/:id/events`                  | `{ template }`                | 201 `EventDraftDto` |
| `GET /organisations/:id/events`                   | none                          | 200 `EventListDto`  |
| `GET /organisations/:id/events/:eventId`          | none                          | 200 `EventDraftDto` |
| `PATCH /organisations/:id/events/:eventId`        | `EventDraftPatch`             | 200 `EventDraftDto` |
| `POST /organisations/:id/events/:eventId/publish` | none                          | 200 `EventDraftDto` |
| `POST …/events/:eventId/ticket-types`             | `TicketTypeInput`             | 201 `EventDraftDto` |
| `PATCH …/events/:eventId/ticket-types/:typeId`    | `TicketTypeInput`             | 200 `EventDraftDto` |
| `DELETE …/events/:eventId/ticket-types/:typeId`   | none                          | 200 `EventDraftDto` |
| `PUT …/events/:eventId/banner`                    | the image (raw body, ≤ 10 MB) | 200 `EventDraftDto` |
| `DELETE …/events/:eventId/banner`                 | none                          | 200 `EventDraftDto` |

- **Templates.** A new event starts as a draft with one free "General admission" ticket type
  (capacity 40 for a workshop, 100 for a gig or blank, 150 for a school night, 30 for a meetup;
  up to 10 per order; on sale from publishing until the event starts).
- **Autosave.** `PATCH` takes any subset of fields plus `version`, the version the client last
  saw. `null` clears `name`, `startsAt`, `endsAt`, `venue` or `contactEmail`; a live event refuses
  clearing any of these with `422 required_when_live`. A bad field gets `422` with `field` set,
  so the client can drop that field and save the rest. Every change, including ticket types and banners, bumps the version, so ticket-type and
  banner routes return the whole event. A stale version gets `409 stale_draft` with the current
  draft in `current`.
- **Plain text (SEC-3).** `about` and `accessibility.notes` are stored as plain text: HTML tags and
  comments, control characters, zero-width characters and direction overrides are removed,
  repeating until nothing changes, so the stored text never holds a `<` followed by a letter, `/`,
  `!` or `?` (nested tricks like `<scr<script>ipt>` included). `Kids < 12` and `<3` stay. Render
  them as text, never as HTML. Single-line fields (the event name, ticket type names and a place
  venue's name, address and suburb) get the same cleaning with line breaks collapsed to one space;
  a name that is empty once cleaned gets `422 invalid_request`.
- **Banner.** Send the image itself with `Content-Type: image/jpeg`, `image/png` or `image/webp`.
  The file must start with a JPEG, PNG or WebP signature. The api decodes it whatever the header says, turns it upright, crops it to 2:1 (at most
  2160 × 1080), re-encodes it as WebP and drops all metadata (EXIF, GPS). Each upload gets a new
  URL. The crop focus is set with `bannerFocus` in the autosave. Each banner also gets a
  1200 × 630 JPEG for link previews (`BannerDto.ogUrl`), cut from the 2:1 banner.
- **Publishing** needs a name, a start and end in the future with the end after the start, a venue
  or online link, at least one ticket type and a saved contact email. Otherwise `422 not_ready` lists what is missing in
  `missing` (`name`, `date_time`, `venue`, `ticket_type`, `contact_email`), in checklist order. The event gets a
  slug (the name in kebab case plus a random suffix) and its public page is live at once.
  Publishing an event that is already live returns it unchanged.
- **Contact email.** Publishing keeps it exactly as the organiser left it and never fills an empty
  one from a member's sign-in email. It is shown only to ticket holders, never on the public page
  (which has `hasContactEmail`). An empty draft contact email causes `422 not_ready` with
  `contact_email` in `missing`. The wizard shows the viewer's own address as an editable prefill,
  saved on blur or Next, and shows the saved address on Review. Existing empty events are not
  backfilled; publishing an already-live event still returns it unchanged (SEC-20).
- **A live event** keeps its name, times, venue, saved contact email and at least one ticket type. Editing a live event
  may not move `startsAt` into the past (`422 starts_in_past`, `field: 'startsAt'`); an
  already-started live event can still edit other fields when `startsAt` is omitted or unchanged.

## Venue lookup

Signed-in only, so the places provider's quota is not open to the public. The provider is a fixed
list of real venues for now (`PLACES_PROVIDER=fake`); a real one comes later behind the same routes.

| Method and path        | Query                        | Success                    |
| ---------------------- | ---------------------------- | -------------------------- |
| `GET /places/search`   | `q` (2 to 100 chars), `city` | 200 `PlaceSearchResponse`  |
| `GET /places/:placeId` | none                         | 200 `PlaceDto` (a `place`) |

Put the returned `PlaceDto` straight into the draft's `venue`. When saving a `place` venue, the api
resolves `placeId` through `PlacesProvider.get(placeId)` on the server and stores the provider's
canonical `name`, `address`, `suburb`, `city`, `lat` and `lng` (cleaned through `toPlainLine`),
ignoring any client-supplied fields; an unknown `placeId` gets `422 unknown_place` (`field: 'venue'`).

## Public routes

No session needed. Only published events are visible; drafts are `404 event_not_found`.

| Method and path            | Query                                      | Success              |
| -------------------------- | ------------------------------------------ | -------------------- |
| `GET /public/events`       | `city`, `when`, `price`, `cursor`, `limit` | 200 `BrowseResponse` |
| `GET /public/events/:slug` | none                                       | 200 `PublicEventDto` |
| `GET /public/banners/:key` | none                                       | 200 WebP image       |

- **Private details stay private.** The public event has no organisation id, no contact email
  (only `hasContactEmail`) and, for online events, no link: those are for ticket holders. The public
  SQL queries (`findPublished` and `browse`) project only public columns and strip online `url` in
  SQL before rows leave Postgres.
- **Browse** lists events that haven't started yet, soonest first, 20 a page by default (up to
  50), with `nextCursor` for the next page. `city` defaults to `sydney`; online events show in
  every city. `when` follows design's handoff (S1-5): wall-clock times in the city's time zone,
  with a night running to 5:00 am. Let D be today, or yesterday before 5:00 am. `tonight` starts
  from 5:00 pm on D (or now, if later) to 5:00 am on D+1; `this_weekend` from 5:00 pm Friday (or
  now) to 5:00 am Monday, the current weekend from Friday to Monday 5:00 am and the coming one
  otherwise; `next_7_days` from now to 5:00 am on D+8. `price=paid` returns nothing until paid tickets exist.
- **Prices** are all-in (fees included) and in whole cents, at most A$10,000 (`EVENT_LIMITS.priceCents`)
  per ticket. Every ticket is free until Sprint 4, so they are 0. `priceFromAllInCents` on a browse
  card and on the event page follows one rule: the cheapest all-in price among the types on sale
  now, or among all types when none is, so a finished early bird stops pulling the price down.
  `price=free` and `price=paid` filter on that same price, so a card under "Free" never shows
  "From A$x". Never work out a price in the web app.
- **Banners** are served by the api only while they are stored on local disk (development). In AWS
  the URL in `BannerDto.url` points at the CDN.
- **Caching (QA 3.2).** A found event and every browse page send
  `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`: shared caches may keep
  them for a minute, browsers always revalidate. A 404, an error and every other api response send
  `no-store`, so a slug that has just gone live is never hidden by a cached miss and nothing private
  is ever cached. Banners are immutable (every upload gets a new key).
- **Revalidation.** Publishing an event, and any later change to it while it's live (details, ticket
  types, banner), makes the api `POST {WEB_INTERNAL_URL}/internal/revalidate` (the web app's private address,
  falling back to `WEB_URL`) with
  `Authorization: Bearer {REVALIDATE_SECRET}` and `{ "slugs": ["<slug>"] }` once the change is
  committed. Slugs never change once published. The web app maps the slug to its own cache tags
  (the event and browse). Each web task has its own cache, so on the private (http) address the
  api posts to every address the hostname resolves to (one Cloud Map record per task), in
  parallel. On the public https fallback it posts once, and the other tasks catch up within the
  minute. The calls time out after 2 s together and a
  failure is only logged: the organiser's change still succeeds, and the page catches up within
  the minute above. Off when `REVALIDATE_SECRET` is unset.

## Errors

| Status | `code`                   | When                                                                 |
| ------ | ------------------------ | -------------------------------------------------------------------- |
| 404    | `event_not_found`        | No such event in this organisation, or not published (public routes) |
| 404    | `ticket_type_not_found`  | No such ticket type on this event                                    |
| 409    | `stale_draft`            | Autosave sent an old `version`; `current` holds the draft as it is   |
| 409    | `last_ticket_type`       | Removing the only ticket type of a live event                        |
| 409    | `tickets_sold_or_held`   | Capacity below the tickets sold or held, or removing such a type     |
| 413    | `image_too_large`        | Banner over 10 MB                                                    |
| 415    | `unsupported_image`      | Banner is not a readable JPEG, PNG or WebP                           |
| 422    | `invalid_request`        | Validation failed; `field` names the first bad field                 |
| 422    | `ends_before_start`      | The end would be at or before the start                              |
| 422    | `starts_in_past`         | Moving `startsAt` of a live event into the past                      |
| 422    | `unknown_place`          | `placeId` on a `place` venue was not found in `PlacesProvider`       |
| 422    | `sales_end_before_start` | A ticket type would stop selling before it starts                    |
| 422    | `paid_tickets_disabled`  | A price above 0 while the `paid_tickets` flag is off                 |
| 422    | `not_ready`              | Publishing with something missing; see `missing`                     |
| 422    | `required_when_live`     | Clearing the venue of a live event                                   |

Validation messages for ticket types are codes too: `max_per_order_over_capacity` and
`sales_end_before_start`.
