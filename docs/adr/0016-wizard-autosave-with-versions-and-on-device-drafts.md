# 0016. Autosave event drafts with a version check, and keep offline edits on the device

- Status: Proposed
- Date: 2026-10-10
- Story: S1-1
- Deciders: FrontendDev, BackendDev

## Context

Organisers build events on their phones, often on patchy mobile data (design 8b). The create-event
wizard has no Save button: the design asks for a save on every field blur and at least every 10
seconds while there are changes, a "Saved on this phone" state when offline, and never blocking
typing while a save is in flight. The same draft can be open in two tabs, or edited offline and then
again online, so two saves can race.

## Options considered

- **Save the whole draft each time, last write wins.** Simple, but a stale tab silently overwrites
  newer work, including fields the organiser never touched there.
- **Send only the changed fields with the version they were based on (chosen).** The api rejects a
  stale version with 409 and its current copy; the browser resends its own changes on top. Fields the
  other tab changed survive.
- **Real-time sync (CRDT or websockets).** Handles every conflict, but far more than a single
  organiser editing their own draft needs.
- **localStorage for offline edits.** Synchronous and small. It blocks the main thread and is shared
  by every tab of the origin, which the threat model asks us to avoid (nothing in `localStorage`).

## Decision

- `PATCH /events/:id` takes only the changed fields plus `version`. A stale version returns 409
  `stale_draft` with the current draft. The browser takes the new version and resends its pending
  changes once; changes typed after a save started always win over what was in flight.
- `apps/web/src/lib/use-autosave.ts` queues changes as they are typed, saves on blur, every 10
  seconds while dirty, when the browser comes back online, and with `keepalive` when the tab is hidden.
- When a save can't reach the api, the pending changes go to IndexedDB (`onetickets` database,
  `event-drafts` store, keyed by event id) and the header shows "Saved on this phone". On the next
  load of that draft they are restored into the form and synced, then deleted from the device.
- Computers get shared, so each entry records the organiser's user id and when it was saved
  (Security review of #17). When the wizard opens for a different organiser, the whole database is
  deleted before anything is read. Entries older than 7 days are dropped. `clearDeviceDrafts()`
  deletes the database outright. The web app has no sign-out control yet; when it gets one, it calls
  this, and the api's `POST /auth/sign-out` is asked to send `Clear-Site-Data: "storage"` as a
  backstop.
- A field the api refuses with 422 is dropped from the queue so the rest still saves.
- Ticket type edits (S1-2 follow-up from QA's #31 review) use the same store under the key
  `{eventId}:ticket`, one entry per type id (or `new` for a type not created yet), holding the form
  fields and the input to send. They are retried when the connection returns and every 10 seconds,
  from whichever wizard step is open, and before publishing. Ticket saves for one event run one at
  a time (`withTicketLock` in `src/lib/ticket-edit.ts`), so a kept "new" type is never created
  twice. An edit the api refuses is dropped, since retrying can't help. Removing a type isn't kept
  offline: the step says it couldn't remove it instead.

## Consequences

- The api must bump `version` on every draft change, ticket-type changes included, and return the
  current draft with a 409.
- Offline edits live only in that browser. Clearing site data before reconnecting loses them, and a
  different device won't see them until they sync.
- IndexedDB holds draft content (event name, times, venue, About text), never tokens or personal
  data about attendees. It is cleared once synced, when someone else signs in on the same browser,
  on sign-out, and after 7 days. Edits left offline for more than a week are lost.
- Revisit if co-organisers start editing the same draft at the same time (S5 team roles): then
  field-level merge or presence becomes worth its cost.
