# Design handoff: Sprints 5 and 6 (receipts, refunds, organiser dashboard)

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 22, new row "Running events" (artboards 10 to 15) plus updates to 2, 6 and 8b. Base tokens: [handoff-s0.md](handoff-s0.md).

Organiser screens are drawn at 390. From 768 px, the organiser area uses a 240 px left nav (Events, Team, Payouts) and a 720 px content column; event tabs (Overview, Attendees, Check-in) stay as a top tab row.

Example amounts follow the S4 worked example (A$50 ticket, A$53.35 all-in, A$3.35 booking fee). ABNs are placeholders.

## Sprint 5

**S5-1 Tax invoices** (artboard 15, lever `gstRegistered`)

- One order view with two invoices: tickets issued on behalf of the organiser (their name and ABN, their own gap-free number series, e.g. PS-000214), and booking fees from OneTickets (OT- series). Then the payment line and the refund policy.
- GST-registered organiser: "Tax invoice: tickets" and an "Includes GST" row. Not registered: "Invoice: tickets", the GST row reads "Not charged", and a note says the organiser isn't registered for GST.
- "PDF" button top right; the PDF uses the same content on A4. The buyer's business name appears when given at checkout (optional field "Business name for the invoice").

**S5-2 Refund policy** (artboard 8b, lever `paidEvent`; shown on 3b, 2 and 15)

- Paid events get "Refund policy" with: up to 7 days before (default), up to 24 hours before, no refunds unless cancelled, or write my own (hint: it can't take away refunds the law gives buyers). Booking fees are never refunded on change of mind.
- Shown as one line on the event page's Cancellations row, above the Pay button, on the ticket, and on the invoice.

**S5-3 Organiser refunds** (artboard 11)

- Refund from an order row opens a bottom sheet: tick tickets (default: none, the organiser picks), reason (Buyer changed their mind: booking fees kept / We changed or cancelled something: booking fees returned), then a marigold summary "Jordan gets back" and "From your balance". The button is red and states the amount: "Refund A$50.00". With nothing ticked it reads "Choose at least 1 ticket".
- After refunding: status line, the row chip becomes "Part refunded" or "Refunded", and refunded tickets scan red immediately.
- Refund is unavailable for a checked-in ticket (button greyed, label explains why).

**S5-4 Cancel an event** (artboard 13; event page artboard 2 lever `cancelled`)

- Reached from the dashboard's "Cancel this event" (red text link, never a primary button). Shows what happens with real totals, a prefilled message to attendees, and a confirm checkbox. Pressing the red button without ticking shows "Tick the box to confirm."
- Done state: "Event cancelled", refunds started, follow progress on Attendees.
- Event page: red "This event is cancelled" notice at the top; sticky bar shows "Cancelled" and "Sales stopped".

**S5-5 Chargebacks** (artboard 6)

- Organiser sees a red "Payout on hold: 1 disputed payment" card under "Needs you" on home, linking to the event. No action needed from them; copy says we'll email.

## Sprint 6

**S6-1 Organiser home** (artboard 6, lever `needsAttention`)

- "Needs you" cards first (marigold for things to do such as unfinished Stripe set-up, red for money on hold). Then a segmented control Upcoming / Drafts / Past. Event cards: title link, date and all-in price, status chip, sold of capacity with a bar, "You get" net revenue, and one action (Open dashboard, Finish setting up, See results). Drafts have a dashed border and say what's still needed.
- "Team" link in the header.

**S6-2 Event dashboard** (artboard 10)

- Ink header with event, status and "Edit"; tabs Overview, Attendees, Check-in (`aria-current="page"` on the active one).
- Two stat tiles: tickets sold of capacity with "+4 today", and "You get" with "paid out after the event". Sales over the last 14 days as bars (today in marigold) with an "Updated" time, a text description for screen readers and "Show as a table". By ticket type: sold of capacity, revenue and a bar each.
- Numbers refresh within a minute; show the "Updated" time rather than animating.
- First sale: email plus push, "Your first sale for {event}! {name} bought 2 tickets."

**S6-3 Attendees** (artboard 11)

- Search by name, email or order number. One card per order: name, email, order number, tickets, status chip. Row actions: Resend (status "Tickets resent to …"), Refund, View order. Paging: "Showing 3 of 24 orders" then load more.
- Organisers see only what the buyer gave for their own events.

**S6-4 CSV export** (artboard 10, "Download attendees or orders")

- Bottom sheet: Attendees (one row per ticket) or Orders (one row per order with totals, fees, GST and refunds), a privacy note that we log downloads, "Download CSV".

**S6-5 Safe edits** (artboard 12; the artboard shows both states at once)

- Blue notice at the top: people have tickets, and we'll ask before emailing them. Changed fields get a marigold "Changed" chip and "Was Thu 18 Feb".
- Capacity below sold is an inline error: "25 are already sold. Set 25 or more." and blocks saving.
- Saving a date, time or venue change opens "Email the 31 people with tickets?" with an optional note: "Save and email them" or "Save without emailing". The email includes a new calendar invite and a release-ticket link.
- "Change history" lists what changed, who and when.

**S6-6 Team** (artboard 14)

- Role explainer (Owner, Admin, Finance, Door staff; MFA note for Owner and Finance). Members as cards with a role select and Remove; pending invites show "Invited" and "Cancel invite". The owner's own row can't be changed. "Invite someone" opens the same invite form as 9c, with all roles.
