# 0017. Public event reads through a row-level security policy, with plain-text descriptions

- Status: Proposed
- Date: 2026-10-10
- Story: S1-1 to S1-5, SEC-3
- Deciders: BackendDev, with FrontendDev, PM and the Security reviewer

## Context

Sprint 1 makes events public: anyone can open an event page or browse upcoming events without
signing in. Until now every row the api read was fenced to one organisation by row-level security
([ADR 0004](0004-postgres-row-level-security-for-tenancy.md)). Public pages need to read across
organisations, but drafts, contact emails and online links must stay private. Organisers also write
free-text descriptions that end up on public pages, in emails and in link previews.

## Decision

- **Publish through a policy, not a bypass.** `catalogue.events` and `catalogue.ticket_types` get a
  second `ot_app` select policy for `status = 'published'`. Public routes run with no organisation
  set, so they can see published rows and nothing else. Writes keep the tenant policy only.
- **Project explicitly.** Public responses are built field by field as `PublicEventDto` and
  `BrowseCardDto`. They never include the organisation id, the contact email (only
  `hasContactEmail`) or an online event's link (ticket holders get it from Sprint 2). A shared
  type test and an api test check this.
- **Organiser names through one narrow function.** `catalogue.organiser_name()` returns only the
  name, and only for organisations with a published event, instead of opening
  `identity.organisations` to the public. It runs as `ot_public_reader`, a no-login role that can
  read only those columns, so the security-definer function holds no wider rights than it needs.
- **Descriptions are plain text.** The api strips HTML tags and comments, control characters,
  zero-width characters and direction overrides before storing `about` and accessibility notes.
  The web renders them as text, never as HTML. Names, ticket type names and venue text get the
  same cleaning on one line, so a direction override cannot disguise a name in browse or a link
  preview.
- **Banners are re-encoded.** Uploads are decoded, turned upright, cropped to 2:1 and re-encoded as
  WebP, so EXIF (including GPS) and anything hidden in the file are dropped. Each upload gets a new
  random key behind a storage interface (local disk now, S3 and CloudFront in AWS).
- **Venue lookup sits behind the api** (`/places`, signed in only), behind a `PlacesProvider`
  interface. For now it is a fixed list of real venues (`PLACES_PROVIDER=fake`) for local
  development, tests and staging. A keyed or paid provider (Google Places, Mapbox and so on) needs a
  cost line and tegs's sign-off before it is used anywhere.

## Options considered

- **A separate public read model** (a table or view refreshed on publish): cleaner separation, but
  a second copy to keep in step for a handful of fields.
- **Running public reads as `ot_worker`**: no new policy, but a role that sees every draft would
  serve anonymous traffic.
- **Sanitised HTML or Markdown descriptions**: richer formatting, but a sanitiser to maintain and a
  bigger attack surface on every page and email that shows the text.

## Consequences

- One policy decides what is public, and the RLS test covers it.
- Adding a column to `catalogue.events` does not make it public by accident, because public DTOs
  name their fields.
- Organisers get line breaks but no formatting until a later story needs it.
