# Design handoff: Sprints 8 and 9 (wallet, sharing, accessibility, big on-sale)

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 27, rows "Wallet, sharing and Companion Card (Sprint 8)" (artboards 19 to 21) and "Big on-sale (Sprint 9)" (22, 22b), plus a Promote link on 10. Base tokens: [handoff-s0.md](handoff-s0.md).

## Sprint 8

**S8-1 Wallet passes** (artboard 19, lever `changed`; artboard 4)

- The ticket screen's "Add to wallet" button becomes the device's own: Apple's official "Add to Apple Wallet" badge on iOS, Google's "Add to Google Wallet" button on Android, both elsewhere. Use the official artwork unchanged and at its minimum size; don't redraw them. The same buttons go in the confirmation email (per ticket) and on My tickets.
- Pass front (indigo, white text, lavender #C9C6FA labels): OneTickets, Doors, Event, Date, Starts, Venue, Name, Ticket type, QR with the ticket ref. One pass per ticket.
- Back of the pass: change notes ("Updated 3 Feb: start time moved…"), access summary, organiser contact, "Release your ticket" link, order number and My tickets link, "Sold by {organiser}. Sent by OneTickets."
- When date, time or venue changes (S6-5 "Save and email them"), passes update in place and the wallet shows a notification: "{Field} changed: now {new value}. Your ticket still works." Refunded or released tickets update the pass to "No longer valid" and the QR is removed.
- Reminder 24 hours before: email for everyone, SMS only where opted in. Copy below.

**S8-2 Share kit** (artboards 20, 20b, 20c; artboard 10)

- From the dashboard's "Promote: link, poster and story". Three blocks: event link with Copy; Instagram story (preview, "Share to Instagram" via the share sheet with the image, "Save image"); QR poster ("Download poster (PDF)").
- Options: show price, show banner (both on). Note: re-download after changing date, time or venue; old QR codes still open the right page (the QR encodes the event's permanent short link).
- Poster: A4, banner (or template colour), title 64 px, date and time, venue, price, then a dashed rule, 230 px QR, "Scan to get tickets", short URL, "Sold by {organiser}. Tickets by OneTickets."
- Story: 1080 × 1920, keep the top 240 px and bottom 300 px clear of text for Instagram's own UI. Banner, title, date and time, suburb, price, marigold "Get tickets: tap the link" (the organiser adds a link sticker).

**S8-3 Companion Card** (artboard 21, lever `side`)

- Organiser (in step 2 Tickets of the wizard, for paid events): "Companion Card" card with a switch, **on by default** (default to confirm with tegs; it suits venues that are Companion Card affiliates, and organisers can switch it off), "Free with" checkboxes for each paid type, and the rules: one companion ticket per paid ticket, A$0 with no booking fee, counts towards capacity, buyers enter the card number, door staff see "Companion Card" on the scan.
- Buyer checkout: "Bringing someone who assists you?" with a checkbox "I have a Companion Card. Add a free ticket for my companion." Ticking it reveals "Companion Card number" with hint "It's on the front of your card. Any state's card works. You may be asked to show it at the door." Summary adds "1 × Companion A$0.00"; the button counts tickets.
- Scanner (9b): companion tickets show a marigold "Companion Card" line under the green result so staff can ask to see the card. Never refuse entry for not having the card on screen.

**S8-4 Accessibility audit** (no new artboards)
Run on event page, checkout (free and paid), ticket, create event (all four steps) and scanner, at 375 px and 200% zoom, with VoiceOver (iOS Safari), TalkBack (Android Chrome) and keyboard only (desktop Chrome).

| Check           | Pass if                                                                                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast        | Body text 4.5:1, large text and icons 3:1, including placeholder text, chips, disabled-but-readable labels and the door screens' dark theme                                                                                                               |
| Targets         | Every control 44 × 44 px or larger, including steppers, chip filters, pager arrows and close buttons                                                                                                                                                      |
| Keyboard        | Every action reachable with Tab, Enter and Space; focus order follows the screen; the focus ring is always visible (ink, or white on dark); no traps in bottom sheets; Escape closes sheets and dialogs and returns focus to the opener                   |
| Screen reader   | Headings in order, one h1 per screen; form fields have labels and errors linked with aria-describedby; status changes (holds, "Saved", "Copied", scan results) announced via role="status" or role="alert"; QR has a text alternative with the ticket ref |
| Zoom and reflow | Nothing cut off or overlapping at 200% zoom and 320 px width; no horizontal scroll except data tables in their own box                                                                                                                                    |
| Time            | Checkout has no hard timeout while the buyer is active; hold messages never count down; the waiting room keeps a place for 10 minutes after losing connection                                                                                             |
| Motion          | Respects reduced motion (no animated progress or confetti)                                                                                                                                                                                                |
| Magnifier       | At 4× magnification, the price, the total and the primary button stay near each other (the sticky bar does this)                                                                                                                                          |

Log each failure with screen, check, severity (SEV1 to SEV3, as in the usability plan) and owner before the sprint ends.

## Sprint 9

**S9-1 Waiting room** (artboard 22, lever `state`; ARCH-2)

- `before`: "Tickets go on sale at 10:00 am", countdown, Turnstile check, why refreshing won't help, payment tip.
- `queued`: people ahead of you, a progress bar, an honest estimate with its "Updated" time, keep-open and one-place-per-device tips, "Tickets are still available."
- `allHeld` (ARCH-2): every ticket is in someone's checkout but not sold. Say so plainly; the buyer keeps their place; "We'll tell you straight away if the event sells out." Never show "Sold out" here.
- `turn`: "It's your turn", "Choose tickets". The spot is kept while active; 10 minutes of inactivity passes it on.
- `soldOut`: only when every ticket is paid for. "You weren't charged anything."
- The headline region is aria-live="polite"; update the count no more than every 15 seconds so screen readers aren't flooded.

**S9-1 settings** (artboard 22b, lever `capacity`)

- "On-sale settings" in the wizard's Tickets step: Waiting room switch, locked on at 1,000 tickets or more (threshold to confirm with PM and BackendDev), optional below. "Open the waiting room" 15, 30 (default) or 60 minutes before sales start. "Most tickets per buyer", counted across email, card and device (S9-2). The admission rate is set by OneTickets, not the organiser.

**S9-2 to S9-4** need no new screens: Turnstile appears in 22 `before`, and the per-buyer limit in 22b. When a limit is hit at checkout: "You've reached the limit of {n} tickets for this event."

## Copy

| Where                  | Copy                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reminder email subject | Tomorrow: {event} at {time}                                                                                                                                                                                              |
| Reminder email body    | Hi {first name}, see you tomorrow at **{event}**. / {date} · doors {time} / {venue}, {address} / [Show my tickets] · [Get directions] / Access: {summary} / Can't go? [Release your ticket] so someone else can have it. |
| Reminder SMS           | OneTickets: {event} is tomorrow at {time}, {venue suburb}. Your tickets: {short link}. Reply STOP to opt out.                                                                                                            |
| Wallet change notice   | {Field} changed: now {new value}. Your ticket still works.                                                                                                                                                               |
| Share kit heading      | Promote your event                                                                                                                                                                                                       |
| Companion checkbox     | I have a Companion Card. Add a free ticket for my companion.                                                                                                                                                             |
| Per-buyer limit        | You've reached the limit of {n} tickets for this event.                                                                                                                                                                  |
| Waiting room states    | See artboard 22; the canvas wording is final.                                                                                                                                                                            |

## Assumptions (accepted by PM as DES-6; listed for BackendDev and QA)

- Companion Card switch is on by default for paid events; one companion per paid ticket, A$0, no booking fee, counts towards capacity.
- Waiting room locked on at 1,000 tickets or more; opens 30 minutes before sales by default; place kept 10 minutes after losing connection; 10 minutes of inactivity at "your turn" passes the spot on.
- Per-buyer limit counted across email, card and device.
- "All held" is its own waiting-room state (ARCH-2); "Sold out" shows only when every ticket is paid for.
- Reminder SMS only where the buyer opted in.
