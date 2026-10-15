# Design handoff: Sprint 2 (get a free ticket)

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 18, still current for Sprint 2 on version 26. Base tokens and components: [handoff-s0.md](handoff-s0.md). Covers S2-2 and S2-4, plus the sold-out states S2-1 needs. Final wording: [copy-s0-s2.md](copy-s0-s2.md), which wins over the canvas.

**Since version 18 (checked 10 Oct):** build Sprint 2 without the later additions:

- 4 Your ticket: "Add to wallet" is S8. In S2 the actions are Add to calendar (full width) and Find more events.
- 3b Paid checkout and the Companion Card checkout (21) are S4 and S8; S2 uses 3 Free ticket checkout only.

## S2-1 Sold out (event page)

Artboard **2 Event page**, lever `soldOut`.

- Sticky bar: "All 40 taken" and a grey "Sold out" label in place of Get tickets (not a disabled button). Price row: "Sold out; spots that are released go back on sale here."
- "Sold out" only when sold = capacity. Held tickets never show as sold out (ARCH-2): while holds keep a type full, show "All taken right now. Check back in a few minutes." with Get tickets still visible, and let checkout report what's left.

## S2-2 One-screen free checkout

Artboard **3 Free ticket checkout**, lever `scenario` (default, typeSoldOut, ranOut, booking).

- One screen: hold notice, one row per ticket type with a stepper (min 0, max = per-order limit or what's left), name, email, optional opt-in, summary, pinned primary button.
- Arriving from the event page with one ticket type preselects 1. With several types, the first available type starts at 1, the rest at 0.
- Primary label follows the total: "Get 2 free tickets"; with 0 selected it reads "Choose at least 1 ticket" and does nothing when pressed.
- Hold notice (`role="status"`, indigo tint): "We're holding 2 tickets for you while you finish. Take your time." No countdown. The hold renews every 5 minutes while the page has input or focus activity, to 20 minutes. If the hold lapses, try to re-hold silently on submit; only if that fails, show the ran-out alert.
- **typeSoldOut**: that row shows "Free · all taken" and a "Sold out" chip instead of a stepper.
- **ranOut** (fewer left at submit than asked): error alert at the top (`role="alert"`, focus moves to it): "Only 1 General admission ticket was left. We've changed your order to 1. Check it and try again." Steppers update to what's available.
- **booking**: button reads "Booking your tickets…", `aria-disabled="true"`, repeat presses are ignored. Every submit carries the same idempotency key for this checkout session, so a retry returns the same order.
- Validation is inline on submit (and on blur after the first submit): email error "Add the part after the @, like gmail.com" with icon; focus moves to the first bad field. Opt-in is unticked by default and says "(optional)".
- Success goes straight to the confirmation (artboard 4); the in-place "Booked" state on the artboard is only the prototype's.

## S2-4 Confirmation and My tickets

Artboard **4 Your ticket (QR)**, lever `tickets` (1 or 2).

- Confirmation is the ticket screen: "You're going!", the email address the tickets went to, the ticket stub with QR, holder, type, ref.
- Several tickets in one order: one stub at a time with Previous and Next round buttons and "Ticket 1 of 2" (`aria-live="polite"`). Swiping left and right also moves between them. Each QR is its own ticket; door staff scan each.
- Brightness: request max brightness while the QR is on screen where the platform allows (Wake Lock plus a full-white QR card); restore on leave. The note under the QR stays.
- Offline: service worker caches the ticket page and QR images on first load; "Works offline" chip shows once cached. Add to wallet ships in Sprint 8; until then hide that button. Add to calendar offers .ics plus Google Calendar.

Artboard **5 My tickets**, levers `signedIn` and `noUpcoming`.

- Signed in (via the magic link in any ticket email): Upcoming first, Past tab second. Each row: date tile, title, suburb and ticket count, "Show QR".
- **Signed out**: "Find your tickets" with an email field and "Email me a link". After sending: "Check your email. If jordan@example.com has tickets, the link is on its way. It works for 15 minutes." Never say whether the address has tickets.
- **No upcoming tickets**: "No upcoming tickets." and a link "Find something on this weekend".
