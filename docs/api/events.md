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
  clearing the first four with `422 required_when_live`. A bad field gets `422` with `field` set,
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
  or online link, and at least one ticket type. Otherwise `422 not_ready` lists what is missing in
  `missing` (`name`, `date_time`, `venue`, `ticket_type`), in checklist order. The event gets a
  slug (the name in kebab case plus a random suffix) and its public page is live at once.
  Publishing an event that is already live returns it unchanged.
- **Contact email.** With none given, publishing uses the publisher's own email. It is shown only
  to ticket holders, never on the public page.
- **A live event** keeps its name, times, venue and at least one ticket type.

## Venue lookup

Signed-in only, so the places provider's quota is not open to the public. The provider is a fixed
list of real venues for now (`PLACES_PROVIDER=fake`); a real one comes later behind the same routes.

| Method and path        | Query                        | Success                    |
| ---------------------- | ---------------------------- | -------------------------- |
| `GET /places/search`   | `q` (2 to 100 chars), `city` | 200 `PlaceSearchResponse`  |
| `GET /places/:placeId` | none                         | 200 `PlaceDto` (a `place`) |

Put the returned `PlaceDto` straight into the draft's `venue`.

## Public routes

No session needed. Only published events are visible; drafts are `404 event_not_found`.

| Method and path            | Query                                      | Success              |
| -------------------------- | ------------------------------------------ | -------------------- |
| `GET /public/events`       | `city`, `when`, `price`, `cursor`, `limit` | 200 `BrowseResponse` |
| `GET /public/events/:slug` | none                                       | 200 `PublicEventDto` |
| `GET /public/banners/:key` | none                                       | 200 WebP image       |

- **Private details stay private.** The public event has no organisation id, no contact email
  (only `hasContactEmail`) and, for online events, no link: those are for ticket holders.
- **Browse** lists events that haven't started yet, soonest first, 20 a page by default (up to
  50), with `nextCursor` for the next page. `city` defaults to `sydney`; online events show in
  every city. `when` follows design's handoff (S1-5): wall-clock times in the city's time zone,
  with a night running to 5:00 am. Let D be today, or yesterday before 5:00 am. `tonight` starts
  from 5:00 pm on D (or now, if later) to 5:00 am on D+1; `this_weekend` from 5:00 pm Friday (or
  now) to 5:00 am Monday, the current weekend from Friday to Monday 5:00 am and the coming one
  otherwise; `next_7_days` from now to 5:00 am on D+8. `price=paid` returns nothing until paid tickets exist.
- **Prices** are all-in (fees included) and in whole cents, at most A$10,000 (`EVENT_LIMITS.priceCents`)
  per ticket. Every ticket is free until Sprint 4, so they are 0. `priceFromAllInCents` on a browse
  card and on the event page comes from the api's one pricing function: the cheapest all-in price
  across the event's ticket types. `price=free` matches events with a free ticket type, which is
  exactly when that price is 0. Never work out a price in the web app.
- **Banners** are served by the api only while they are stored on local disk (development). In AWS
  the URL in `BannerDto.url` points at the CDN.

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
| 422    | `sales_end_before_start` | A ticket type would stop selling before it starts                    |
| 422    | `paid_tickets_disabled`  | A price above 0 while the `paid_tickets` flag is off                 |
| 422    | `not_ready`              | Publishing with something missing; see `missing`                     |
| 422    | `required_when_live`     | Clearing the venue of a live event                                   |

Validation messages for ticket types are codes too: `max_per_order_over_capacity` and
`sales_end_before_start`.
