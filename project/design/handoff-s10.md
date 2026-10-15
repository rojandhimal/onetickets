# Design handoff: Sprint 10 (onboarding, account, status) and empty states

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 29, row "Launch: onboarding, account, status (Sprint 10)", artboards 23 to 27. Base tokens: [handoff-s0.md](handoff-s0.md). The stories and acceptance criteria are S10-2, S10-3 and S10-4 in the backlog. S10-1 (pen test) has no UI.

## S10-4 Founding organiser onboarding

**First-run guide** (artboard 23, levers `progress` and `founding`)

- Shown on organiser home under the greeting until all four steps are done, or until the organiser picks "Hide guide". When hidden, a status line says "Guide hidden. You can bring it back from Help."
- It's an ordered list of 4 steps with "{n} of 4 done":
  1. Create your first event.
  2. Publish and share it.
  3. Invite your team.
  4. Selling paid tickets? Set up payouts.
- Done steps get a green tick and strikethrough, with visually hidden "Done:". The next step is indigo with visually hidden "Next:" and is the only one with a button. Later steps are grey with visually hidden "To do:".
- Step 4 counts as done for free-only organisers. It never blocks the guide from completing for them.
- It replaces 0b's empty state only after the first event exists. Before that, 0b's template picker is the first step's action.

**Founding offer card** (artboard 23, lever `founding`)

- Ink card with a marigold "Founding organiser" chip and "No OneTickets fees until {end date}". Below it: "Or your first 1,000 tickets, whichever comes first. {used} of 1,000 used." Then a progress bar (`role="progressbar"`) and "How the offer works".
- It's driven by the plan setting (S10-4), never typed by hand. It disappears the day after the offer ends, and the organiser gets an email 14 days before.
- The fee calculator (S4-2) shows the waived fee as "OneTickets fee: A$0.00 (founding offer)". **Assumption:** card processing still applies and is passed on as before. PM to confirm.

**Import from CSV** (artboard 24, lever `step`; reached from the first-run page and from Drafts)

- Step 1, upload. Choose a source (Eventbrite, TryBooking, another CSV), then follow short export instructions for that source.
  - The exact menu steps are a placeholder to check against each product before launch.
  - File field: CSV up to 20 MB, with "We never contact your attendees unless you choose to."
- Step 2, columns. Each OneTickets field has a select of the file's columns, prefilled by header matching, plus "Not in my file".
  - The note under each field reads "Matched", or explains what happens instead: venue is "picked after importing"; capacity is "set on each draft".
- Step 3, preview. "{n} events, {n} attendees" and "They come in as drafts. Nothing is published or sent until you say so."
  - Event cards; any card with a problem gets a marigold border and a line saying what to fix.
  - Checkbox "Email attendees their OneTickets tickets once I publish each event", **off by default**.
  - "{n} rows were skipped because they had no email" links to the skipped rows.
- Done: "{n} drafts ready" with "Go to my drafts".
- Imported attendees get tickets in the system, so door staff can find them by name, but they're only emailed if the box was ticked.

## S10-2 Legal pages, account deletion and data export (artboard 25, lever `state`)

- **Your data and account** is reached from the account menu, for attendees and organisers alike.
- **Download your data:** "Email me my data" emails a download link, usually within an hour. A status line confirms the request.
- **Policies list:** Organiser terms, Purchase terms, Privacy policy, Refund policy, and "Events we don't allow". The same links go in the site footer and in every email footer.
- **Delete your account:**
  - Explains what goes and what stays. Order and tax records are kept for as long as the law requires, with name and email removed where possible. Legal to confirm the wording.
  - "Delete my account…" opens a bottom sheet listing the consequences (upcoming tickets stop working, it can't be undone, a confirmation email follows), a "Type DELETE to confirm" field, a red "Delete my account" button and "Keep my account".
- `ownerBlocked`: the owner of an organisation with upcoming events or a pending payout can't delete. A marigold box explains why, with real numbers, and gives two ways out: hand over ownership on Team, or cancel the events and wait for the last payout.

## S10-3 Public status page (artboard 26, lever `incident`)

- Its own host, so it stays up when OneTickets is down. 720 px column.
- Banner: green "Everything is working" with the last-checked time, or marigold "{what's wrong}" with "Updated {time}. Next update by {time}."
- Incident card: plain-language updates, newest last, each starting with the stage (Investigating, Identified, Fixed) and the time. Always say whether tickets already bought still work.
- Services list: Event pages and browsing; Checkout and payments; Tickets, emails and My tickets; Door scanner; Organiser tools and payouts. Each shows Working or Problems as an icon plus a word, never colour alone.
- "Get updates by email" subscribes. All times are Sydney time.

## Empty states (artboard 27)

**Pattern:**

- A line icon in a 52 px indigo-tint circle.
- A heading saying what's missing.
- One sentence on what fills it.
- At most one secondary action button.
- No illustrations and no invented numbers.

| Where                              | Heading                                                  | Body                                                                                             | Action               |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- |
| 1 Discover, filter with no results | Nothing free this weekend yet (match the active filters) | New events are added every day. Try the next 7 days instead.                                     | Show the next 7 days |
| 6 Organiser home, Drafts           | No drafts                                                | Events you start but don't publish wait here, saved as you go.                                   | none                 |
| 6 Organiser home, Past             | No past events yet                                       | After your first event, you'll see how it went here: sales, check-ins and payouts.               | none                 |
| 11 Attendees, no bookings          | No bookings yet                                          | Share your event link and we'll email you the moment someone books.                              | Promote your event   |
| 9c Live check-in, before doors     | Nobody checked in yet                                    | Scans show here live once door staff start. Doors open at {time}.                                | Invite door staff    |
| 16 Payouts, none yet               | No payouts yet                                           | You're paid a few business days after each paid event ends. Free events have nothing to pay out. | none                 |
| 11 Attendees, search no match      | No one matches "{query}"                                 | Search by name, email or order number, like OT-1042.                                             | none                 |
| 10 Event dashboard, no sales       | No sales yet                                             | The chart starts with your first booking. Sharing your link is the quickest way to get one.      | Promote your event   |
| 18b Admin review queue             | Nothing to review                                        | New organisers' big first events land here before they go on sale.                               | none                 |

The existing empty states stay as drawn: 0b (no events, template picker) and 5 My tickets (no upcoming tickets).

## Assumptions (for PM, BackendDev and QA)

- The founding offer waives the OneTickets fee only; card processing still applies. _To confirm with PM and tegs._
- Import emails attendees only if the organiser ticks the box, which is off by default.
- Data export is delivered by an emailed link that expires (suggest 7 days).
- Deletion is blocked for organisation owners with upcoming events or pending payouts.
- The status page is hosted separately (vendor or static), and subscriptions are email only.
