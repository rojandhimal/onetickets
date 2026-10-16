# Design handoff: Sprint 1 (publish and browse)

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 17, still current for Sprint 1 on version 26. Tokens, focus ring and base components are in [handoff-s0.md](handoff-s0.md); this file covers only what is new for S1-1 to S1-5. Final wording: [copy-s0-s2.md](copy-s0-s2.md), which wins over the canvas.

**Since version 17 (checked 10 Oct):** later sprints added levers and features to some Sprint 1 artboards. Build Sprint 1 with them off or left out:

- 2 Event page: `soldOut` (S2) and `cancelled` (S5) off. Cancellations shows "Cancel any time · Release your ticket up to the start."
- 6 Organiser home: the "Needs you" cards, "You get" amounts and the Past tab are S5 and S6. For S1 build the header, the Upcoming and Drafts segments, and event cards with title, date, status chip, sold of capacity with the bar, and one action (Open event page, or Finish setting up for drafts).
- 8 Tickets: `paidTickets` off, so there's no Free/Paid control and no payouts card. The Companion Card switch (S8) and on-sale settings (S9) are left out.
- 8b Details: `paidEvent` off (no Refund policy section).
- 8c Review: `payoutsPending` off.
- 10 Event dashboard is S6. After publishing in S1, "See your event page" and "Back to your events" are the only links.

Decision taken by default: the event page shows the organiser's banner (PM, pending tegs). If tegs says no, flip `showBanner` off on artboard 2; the fallback is the template colour block already drawn.

## S1-1 Create event wizard

Artboards: **0b** (template picker), **7 Basics**, **8 Tickets**, **8b Details** (new), **8c Review and publish** (new).

- Four steps, one per route (`/organiser/events/new/{basics|tickets|details|review}?draft=…`). The stepper is an `<ol>`; the current step has `aria-current="step"`; completed steps carry a tick and visually hidden ", completed".
- Back arrow on steps 2 to 4 goes to the previous step; the X on step 1 closes and keeps the draft. Steps are reachable in any order once the draft exists.
- Templates (Workshop, Gig, School night, Meetup, blank) prefill: event name placeholder, a starter "About" prompt shown as placeholder text, never saved, so nothing unedited gets published (wording in copy-s0-s2.md; changed 16 Oct), default ticket type (General admission, Free, capacity 40 workshop / 100 gig / 150 school night / 30 meetup), sales end "At start time", and the fallback banner colour (category tint).
- **Autosave**: save on field blur and at least every 10 s while dirty. The header status (`role="status"`) has three states, drawn on 8b via the `saveState` lever:
  - `Draft saved` (tick, #0B5A3A)
  - `Saving…` (slate, no icon)
  - `Saved on this phone` (wifi-off icon, #5C3300) when offline; the draft goes to IndexedDB and syncs when back online, then returns to "Draft saved".
    Never block typing while saving. On reopening, the draft resumes on the last step visited.
- Venue: combobox with address lookup (already on 7). Picking a suggestion stores the place id and geo point. "Online" swaps in a URL field.
- **Publish checklist lives on step 4 only** (removed from step 2). "Needed to publish": event name, date and time, venue (or online link), at least one ticket type. "Nice to have": banner, about, accessibility.
  - The Publish button is never disabled. If something needed is missing, pressing it shows an error notice "Add a venue to publish. Everything else is ready." (`role="alert"`), moves focus to the checklist, and the missing row shows a red alert icon, red "Not added yet" text and an "Add" link to the right step. Toggle `missingVenue` on 8c to see it.
  - Success: the ink "Your event is live" screen (heading receives focus), copy link button, native share button (Web Share API; hide it if unsupported), "See your event page", "Back to your events".

## S1-2 Free ticket types

Artboard **8 Tickets**.

- Fields per type: name, capacity (stepper ±5 plus typed number), max per order, sales start ("When I publish" or a date and time), sales end (At start time, 1 hour before, 1 day before, When the event ends, or a date and time). Picking "Pick a date and time" reveals a date and a time input under that select.
- **Paid behind the flag**: with `paid_tickets` off (S1 default) there is no Free/Paid control; instead a green tick line "Free ticket. No fees for you or your guests." Toggle `paidTickets` on the artboard to see the Sprint 4 version.
- "Add another ticket type" opens a new full card; when there is more than one type, all but the one being edited collapse to a summary row (name, "Free · 10 tickets · up to 2 per order", Edit, delete icon button with `aria-label="Remove {name} ticket"`). Removing asks nothing for a draft; for a published event with bookings on that type, deletion is blocked (S6 handles safe edits).
- Validation: capacity at least 1; max per order between 1 and capacity; sales end after sales start. Errors use the field error pattern from S0.

## S1-3 Event page

Artboards **2 Event page** and **2b Link preview image**.

- Above the fold at 375 × 667 (iPhone SE viewport with the sticky bar), in this order: banner 172 px tall (object-fit cover of the 2:1 upload, focal point from "Adjust crop"), date eyebrow, title, "by {organiser}" link, then a definition list: **Price** (all-in, spots left), **Venue** with a 60 × 52 map thumbnail link that opens the native maps app, **Cancellations**, **Accessibility** (first feature bold, the rest inline, "Details" link to the full section). The organiser card, About, full Accessibility and the large map follow.
- Banner overlay buttons (back, share) are white 44 px circles so they read on any image.
- Sticky bottom bar on mobile: all-in price, spots left, "Get tickets". At 768 px and up, the bar becomes a card pinned in a right-hand column.
- Rich link preview: generate a 1200 × 630 OG image per event (artboard 2b): the banner full bleed, with a white ticket-stub caption 48 px from the edges holding date · time · suburb, title (up to 2 lines, then ellipsis), price and the OneTickets mark. With no banner, use the category tint as the ground. Also set `og:title`, `og:description` (date, venue, price) and `twitter:card=summary_large_image`.

## S1-4 Accessibility details

- Wizard: step 3 (8b) has an Accessibility fieldset: checkboxes for Step-free access, Accessible toilet, Hearing loop, Seating available, Auslan interpreter, Quiet space, plus a free-text "Anything else people should know?" (500 characters).
- Event page: summary row in the key facts (above the fold), full chip list and the free text in the Accessibility section. If nothing is ticked and the text is empty, the row reads "No accessibility details yet" with the secondary line "Booked? Reply to your confirmation email to ask the organiser." There is no link and no email address on the public page (privacy ruling, 10 Oct: the contact email goes only to people with a ticket). A forwarded "Ask the organiser" form comes later as SEC-13, behind BackendDev's accessibilityContact flag; design it then.
- Step 3 also holds About (2,000 characters with a live count), Cancellations (any time / up to 24 h / none) and the contact email for attendees.

## S1-5 Browse upcoming events

Artboard **1 Discover**.

- Search field removed for MVP (full search is post-MVP).
- City: "Near Sydney · Change" opens a city picker (Sydney, Melbourne for launch).
- Filters: When chips (Tonight, This weekend, Next 7 days) and Price chips (Free, Paid). Each group is single select and deselectable; with nothing selected the list shows everything upcoming. The heading follows the When chip. The result count is announced through a visually hidden `role="status"`.
- Card: banner image (category tint and category word when there is none), Free badge, date eyebrow, title, suburb · venue, all-in price ("Free" or "From A$53.35 all-in"). The whole card is one link with an `aria-label` that reads all four facts.
- Empty state: "Nothing on for that yet. Try Next 7 days."
- **What the When chips mean** (settled 15 Oct for QA's #16 question). Times are wall-clock in the selected city's time zone (Australia/Sydney or Australia/Melbourne), so daylight saving is handled by the zone, not a fixed offset. Only events that haven't started yet are shown, like the rest of browse. A "night" runs to 5:00 am, so a 1 am gig is still "tonight".
  - Let D be today's date, or yesterday's if it's before 5:00 am.
  - **Tonight:** starts from the later of now and 5:00 pm on D, up to (not including) 5:00 am on D+1.
  - **This weekend:** starts from the later of now and 5:00 pm Friday, up to 5:00 am Monday. From Monday 5:00 am to Friday, that's the coming weekend. Over a weekend, it's the current one.
  - **Next 7 days:** starts from now up to 5:00 am on D+8, so it's today plus the next 7 days.
  - Examples (Sydney): Thu 10:00 am, Tonight = Thu 5:00 pm to Fri 5:00 am. Sat 1:30 am, Tonight = now to Sat 5:00 am, and This weekend = now to Mon 5:00 am. Sun 11:00 pm, This weekend = now to Mon 5:00 am.
