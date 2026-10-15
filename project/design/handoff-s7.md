# Design handoff: Sprint 7 (get paid)

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 27, new row "Getting paid and admin (Sprint 7)": artboards 16, 17, 18 and 18b, plus an update to 10. Base tokens: [handoff-s0.md](handoff-s0.md). Example amounts continue the S4 to S6 example (A$50 tickets, A$3.35 booking fee passed on to buyers). ABNs and Stripe references are placeholders.

## S7-1 Post-event payouts (artboard 16 Payouts, lever `hold`; artboard 10)

- Organiser area, Owner and Finance only (Admin and Door staff don't see the nav item). Reached from the left nav (Events, Team, Payouts) and from the dashboard's "You get" tile, which now reads "after fees · paid Tue 23 Feb" from the first sale, linking to Payouts.
- **Next payout** card (ink): amount, date with a status chip (Scheduled, Paused, Delayed, On hold), event, "Paid 3 business days after the event, to ANZ ••• 4821", link to the settlement report.
- **Coming up**: events not yet paid, with event date, payout date and "so far" amount. **Paid**: history with payout date, amount and a Report link.
- **Paid to**: bank last 4 from Stripe, a note that changing bank or email pauses payouts for 48 hours and emails the owner, and "Change bank details" (opens Stripe Express in a new tab; external-link icon and sr text).
- Hold states (`hold` lever), shown as a notice at the top with `role="status"`:
  - `bankChange` (marigold): "Payouts paused until Thu 25 Feb, 2:14 pm". Names who changed it and when, says the owner was emailed, and links "Didn't make this change? Contact us now". The next payout date moves to the end of the hold.
  - `checking` (indigo tint): the S7-3 reconciliation hold. "We're double-checking a payment". No action needed; we email when it's on its way. Never say "mismatch" or "error" to the organiser.
  - `dispute` (red): same card as S5-5, with the disputed amount.
- **Hold period is configurable** (per organisation, set by OneTickets admins). The default of **3 business days is pending tegs's decision**: every place that shows it ("Paid {hold} after the event", the payout date, the dashboard tile) reads it from config, never hard-coded copy. Business days skip NSW and VIC public holidays, by the event's state.
- **Step-up MFA** (lever `stepUp`): opening Payouts or changing bank details asks for a fresh authenticator code, even when signed in. Bottom sheet "Confirm it's you", 6-digit field (`autocomplete="one-time-code"`, numeric), Confirm, "Use a recovery code instead", and the line "If you use a recovery code, we'll email you to say so." Closing it goes back to the events list, never into Payouts. Wrong code: "That code didn't work. Check your app and try again." under the field.
- **SEC-8 security notices** (user-level security log; emails go to the user, not just the organisation owner). Must ship before payouts go live:
  - Recovery code used: subject "A recovery code was used on your OneTickets account". Body: "Someone signed in to {email} with a recovery code on {date, time} from {city, device}. You have {n} codes left. Not you? [Secure your account]."
  - MFA reset: subject "Two-step sign-in was reset on your OneTickets account". Body: "Two-step sign-in for {email} was reset on {date, time} by {who}. Payouts are paused for 48 hours. Not you? [Contact OneTickets]."
  - Bank details changed: as in the copy table below.
- **ARCH-1**: Stripe charges use on_behalf_of, so the organiser is the seller. The settlement report, invoices and payout emails always name the organiser as seller ("Sold by {organiser}"); OneTickets appears only for its booking fees.

## S7-2 Settlement report (artboard 17, lever `gstRegistered`)

- One per event, from Payouts or the history. Heading: event, date, organiser name and ABN.
- Table: Tickets sold (n), Refunds (n tickets, negative), Ticket revenue, Includes GST (or "Not registered"), OneTickets fees, Card processing, then **Your payout** (dashed rule), with paid date, bank and Stripe payout reference.
- Marigold note "Why fees are A$0.00" when fees are passed on: booking fees paid by buyers to OneTickets with their GST, and that they cover card processing. When the organiser absorbed fees, the fee rows show the deductions and this note is hidden.
- "For your accountant": **Download CSV** (one row per order: order number, date, buyer, ticket type, quantity, ticket amount, GST, booking fee, refunds, invoice numbers) and **Download for Xero** (Xero's bank statement CSV import format: Date, Amount, Payee, Description, Reference). A status line confirms the file name.

## S7-3 Daily reconciliation (artboard 18b, lever `mismatch`; artboard 16 `checking`)

- Admin "Stripe check" section: the last run's result (green: items matched, no payouts held; red: count unmatched, which payout is held, when on-call was paged).
- Unmatched table (scrolls sideways on narrow screens): Stripe item id and type, amount, problem in plain words, payout held (organiser and date), owner, "Open order".
- Rule shown under the table: resolve only with a note; the payout is released after the next clean run, or by an admin with a second admin's approval.
- The top bar chip shows the same status on every admin page.

## S7-4 Admin console (artboards 18 and 18b, lever `dialog` on 18)

- Desktop-first page (works down to phone width: the nav and panels stack). Ink top bar with "OneTickets admin", the Stripe check chip, and the signed-in staff member, role and "signed in with SSO".
- Left nav: Look up, Review queue (count badge), Stripe check, Audit log.
- **Look up**: one search across users, organisations, events, orders and invoice numbers. Results list on the left, detail on the right. Order detail: buyer, event (with state), organiser (with payout state), tickets, payment, invoices.
- Actions grouped "This order" (Resend tickets, Refund…) and "Event and organiser" (Take down event…, Freeze payouts…, in red text). Each "…" action opens a dialog that lists what will happen, requires a **reason** (saved to the audit log), and has a red confirm button naming the action and amount. Confirm without a reason shows "Add a reason. It's saved to the audit log." under the field.
- Footer line on every detail panel: actions are saved to the audit log with name, time and reason, and nobody can edit or delete it.
- **Review queue**: first events from new organisers whose capacity × price is over A$10,000. Each card: event, organiser, sign-up age, date and city, the maximum gross with the sum, and signals (Stripe identity status, ABN match, venue check). Approve (primary), Ask for info, Reject… (red, needs a reason, as above). The organiser sees "We're checking your event, usually within 1 business day" on their review step and event card until it's decided.
- Staff sign-in is SSO with MFA (no OneTickets password screen to design).

## Copy

| Where                              | Copy                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payouts nav / heading              | Payouts                                                                                                                                                                     |
| Dashboard tile                     | after fees · paid {Tue 23 Feb}                                                                                                                                              |
| Next payout chip                   | Scheduled · Paused · Delayed · On hold                                                                                                                                      |
| Bank note                          | Changing your bank account or email pauses payouts for 48 hours, and we email the owner. This keeps your money safe if someone else gets into your account.                 |
| Hold email to owner (subject)      | Your OneTickets bank details were changed                                                                                                                                   |
| Hold email body                    | {name} changed the bank account for {organisation} on {date}. Payouts are paused until {date, time}. If this wasn't you or your team, contact us now: [Contact OneTickets]. |
| Payout sent email (subject / body) | A${amount} is on its way / Your payout for {event} was sent to {bank} ••• {last4}. It usually arrives within 1 business day. [See the settlement report]                    |
| Event under review (organiser)     | We're checking your event, usually within 1 business day. We'll email you when it's on sale.                                                                                |

## Assumptions (accepted by PM as DES-6; listed for BackendDev and QA)

- Payouts are visible to Owner and Finance only; both need step-up MFA to open them.
- Hold period: configurable, default 3 business days pending tegs. Public holidays by the event's state.
- A reconciliation hold reads "We're double-checking a payment" to the organiser; never "mismatch".
- Admin refunds, takedowns and freezes need a reason saved to the append-only audit log. Releasing a reconciliation-held payout manually needs a second admin's approval.
- Manual review threshold: capacity × highest ticket price over A$10,000, first event of a new organiser.
- Xero export uses Xero's bank statement CSV import columns.
