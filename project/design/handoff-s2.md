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
- Brightness: keep the screen on with Wake Lock while the QR is visible; a web page can't raise brightness, so the note asks people to. Details under S2-3 below.
- Offline: service worker caches the ticket page and QR images on first load; "Works offline" chip shows once cached. Add to wallet ships in Sprint 8; until then hide that button. Add to calendar offers .ics plus Google Calendar.

### S2-3 builds the confirmation screen on its own (added 22 Oct)

S2-3 ships artboard 4 before My tickets (S2-4) exists. Fill-ins for what the artboard doesn't show:

- **Back link:** the artboard's "My tickets" link at the top left is hidden until S2-4 ships. The offline chip sits on the right alone.
- **Date line:** "{Sat 14 Nov} · {10:00 am}", the event's start in the event's time zone. There's no doors field yet, so don't show "Doors". Venue line as on the event page; online events read "Online · the link is in your email".
- **One ticket:** no pager, no "Ticket 1 of 1"; the stub's label is "Your ticket". **Several:** as above. Every stub shows the one name given at checkout.
- **Brightness:** a web page can't raise screen brightness. Use the Wake Lock API to keep the screen on while a QR is visible, release it on leave or when the tab is hidden, and re-request when it's visible again. The QR card stays white at full contrast. The note under the QR changes to "Turn your screen brightness up at the door so it scans first time." (copy doc updated). Show it on every stub.
- **Offline chip:** shows only once the service worker has cached this page and every QR in the order. Never show it before then, and never a "not offline yet" state.
- **Add to calendar:** full-width white button. Pressing it opens a small menu (a bottom sheet under 640 px, a popover above): "Apple Calendar or Outlook" downloads the .ics; "Google Calendar" opens Google's add-event link in a new tab. Esc and a tap outside close it; focus returns to the button. Calendar event: title = event name; start and end with the event's time zone; location = venue name and address (online: "Online"); description = the public event page link and "Your tickets are in your email from OneTickets." **Never put the ticket page link in the calendar event**: it opens the tickets and Google would hold it.
- **Loading** (opening the page from a link, not straight after checkout): the indigo page with a white stub of grey blocks where the text and QR go, `aria-busy="true"`, and a visually hidden "Loading your tickets". No spinner. Straight after checkout, render from the order the api just returned, with no loading state.
- **Can't load, offline and not cached:** a white card on indigo: "**We couldn't load your tickets.** Check your connection and try again. Your tickets are also in your email." with a "Try again" button.
- **Link not valid or expired:** "**That link doesn't work any more.** Open the latest ticket email from OneTickets and use the link in it." Until S2-4 ships there's no "email me a link" form here.
- **Desktop (1280):** the same column, 420 px wide, centred on the indigo page, with the actions under the stub. Swipe is touch only; the round buttons do the work everywhere.

Artboard **5 My tickets**, levers `signedIn` and `noUpcoming`.

- Signed in (via the magic link in any ticket email): Upcoming first, Past tab second. Each row: date tile, title, suburb and ticket count, "Show QR".
- **Signed out**: "Find your tickets" with an email field and "Email me a link". After sending: "Check your email. If jordan@example.com has tickets, the link is on its way. It works for 15 minutes." Never say whether the address has tickets.
- **No upcoming tickets**: "No upcoming tickets." and a link "Find something on this weekend".
