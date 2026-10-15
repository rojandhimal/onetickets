# Design handoff: Sprint 4 (buy a paid ticket)

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 20. Includes SEC-1 (card-testing defences) and ARCH-1 (organiser is the seller).

## S4-1 Stripe Connect onboarding

Artboards **8 Tickets** (levers `paidTickets` on, `payoutsReady`) and **8c Review** (lever `payoutsPending`).

- Choosing Paid on a ticket type when the organisation has no charge-ready Stripe account shows "Set up payouts to sell paid tickets": what Stripe will ask for (ABN, ID, bank), about 5 minutes, "Set up payouts with Stripe" (opens Express hosted onboarding in a new tab, external-link icon), "We never see your bank details." The organiser can keep building.
- Returning from Stripe: when charges are enabled, the card becomes "Payouts set up: ••• 4821, ANZ" (last 4 and bank name from Stripe). If Stripe still needs something, keep the card with the button text "Finish setting up with Stripe".
- Review step: "Payouts set up" becomes a required row ("Stripe still needs your ID") and publish is blocked with "Finish setting up payouts to publish paid tickets."

## S4-2 Fee calculator

Artboard **8 Tickets** with `paidTickets` on.

- Price field "A$" prefix, "In Australian dollars, before fees." Below it the marigold-tint calculator: Buyer pays (all-in, incl. GST), Fees, You get per ticket. Fees passed on by default; "I'll absorb the fees" checkbox swaps the numbers. A$50.00 passed on reads A$53.35 / A$3.35 / A$50.00, matching the architecture doc.
- Every price shown anywhere (cards, event page, checkout, receipts) comes from the one pricing function and is the all-in figure.

## S4-3 Pay by card, Apple Pay or Google Pay (with SEC-1, ARCH-1)

Artboard **3b Paid checkout**, lever `scenario` (default, declined, threeDS, challenge, tooMany, paying).

- Same one-screen layout as free checkout. Ticket rows show "A$53.35 each, all-in". Email hint: "Tickets and your tax invoice go here."
- Pay section is the Stripe Payment Element styled with our tokens (Appearance API: radius 12, border #8A8A9A 1.5 px, focus ring ink, font Figtree 16). Wallets first (Apple Pay, then Google Pay, only those the device supports), then "or pay by card", then card number, expiry, security code. Lock line: "Card details go straight to Stripe. OneTickets never sees them."
- Summary: line items, booking fees, Total, "Includes GST. This is the price you saw on the event page." The total must equal what the event page showed for the same quantity.
- **ARCH-1 seller line** above the button: "Sold by {organiser legal name} (ABN {abn}). OneTickets takes payment on their behalf; your card statement will show {descriptor}." plus the refund policy summary and link. The descriptor on the canvas is an example; use the connected account's real statement descriptor.
- Primary button: "Pay A$106.70" (the exact total).
- States:
  - **declined**: card field turns red, inline error with icon under the card fields (`role="alert"`): "Your bank declined this card. Try another card, Apple Pay or Google Pay. You haven't been charged." Focus goes to the card number. Use Stripe's decline code to pick the copy (insufficient funds, expired, incorrect CVC each get their own line).
  - **threeDS**: bottom sheet `role="dialog"` "Confirm with your bank", info "We've held your tickets for another 5 minutes while you do this.", Stripe's 3DS frame, "Cancel and choose another way to pay". The hold is extended once.
  - **challenge** (SEC-1): Turnstile runs invisibly on load. Only when Cloudflare asks for interaction, show the managed widget above the summary ("Confirm you're a person"). Never block wallets behind it if Turnstile already passed.
  - **tooMany** (SEC-1 rate limits per IP, email or card): error alert at the top: "Too many payment attempts. For your security, wait 10 minutes and try again. Your tickets are still held." Button greyed with `aria-disabled` and the label "Try again in 10 minutes"; the hold is kept.
  - **paying**: "Paying A$106.70…", `aria-disabled="true"`, ignore repeat presses. On success go to the confirmation (artboard 4).

## S4-4 Webhook confirms the order

No new screen. While the webhook is pending after a successful payment, the confirmation shows the ticket stubs with a "Finishing up…" line in place of the QR for up to 60 s, then the QR. If a late payment cannot be honoured, the buyer gets the refund email; the confirmation shows "Sorry, those tickets sold out while you were paying. We've refunded A$106.70 to your card." with a link back to the event.
