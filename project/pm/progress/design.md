# Progress: design

Newest first. Format: date, Done, Next, Blocked.

## 2026-10-23 (Claude)

- **Done:** Copy and flow for S2-4a "Remove tickets from this device" (copy-s0-s2.md). Approved [#62](https://github.com/rojandhimal/onetickets/pull/62) at eebd9b7 and again at d99df5f (Remove shows whenever the order is saved), rendered at 375 and 1280, 0 axe violations. Re-approved #56 at 8dfed02.
- **Done:** DES-10 sold-out bar copy (no number: "All tickets taken · Sold out"; held: "All taken right now", Get tickets kept). Approved [#66](https://github.com/rojandhimal/onetickets/pull/66) at c695a7c from the diff (copy in existing, already-reviewed elements).
- **Next:** S2-4 My tickets reviews when they open.
- **Blocked:** Nothing.

## 2026-10-22 (Claude), later

- **Done:** Approved #56 at 3336dff after the fixes, and re-approved at 8dfed02 (saved copy only when the network fails; no UI change).
- **Done:** Reviewed [#56](https://github.com/rojandhimal/onetickets/pull/56) (S2-3 ticket screen) at c3c54ac, rendered at 375 and 1280: changes needed (revoked-ticket copy, a status line while a QR is being signed). Added the copy rows.
- **Done:** Unpaused. Filled the S2-3 gaps in handoff-s2.md ("S2-3 builds the confirmation screen on its own") and copy-s0-s2.md: Wake Lock instead of a brightness boost (new QR note), the calendar menu with no ticket link in calendars, the one-ticket layout, and the loading, offline and bad-link states. Sent them to FrontendDev.
- **Next:** S2-4 My tickets reviews when they open. S2-2 #59 has the other tool's design pass at 3c2ff43; re-check only if its UI changes.
- **Blocked:** Nothing.

## 22 Oct 2026

- **Blocked:** On hold at PM's request until tegs says which team runs OneTickets from here (another team ran Sprint 1 acceptance and Sprint 2 from 17 to 22 Oct). No PR reviews or new design work until PM sends it.

## 16 Oct 2026

- **Done:** Design review of [PR #23](https://github.com/rojandhimal/onetickets/pull/23) (S1-3 event page), rendered at 375 and 1280 px with a mock api: changes needed. One must-fix: prices show "$53.35", not "A$53.35". Everything else matches handoff-s1 and artboards 2 and 2b.
- **Done (later):** Approved #23 at 04848fe (A$ fixed in shared formatAud). Nits deferred to S1-2 and booking.
- **Done (later):** Post-merge review of [#31](https://github.com/rojandhimal/onetickets/pull/31) (S1-2 ticket types), run end to end at 375 and 1280 px: approved, with 3 small fixes riding S1-4 (drop the lede, Edit aria-label, header status wrap). For S1-4: About uses template placeholder prompts, not prefilled text, and the cancellation radio labels are final. Updated copy-s0-s2.md, handoff-s1.md and the canvas (v32, 8b).
- **Done (later):** Reviewed [#35](https://github.com/rojandhimal/onetickets/pull/35) (S1-4 details): changes needed. Must fix: About as placeholder prompts, not saved starter text. The #31 follow-ups are still to land. Approved the email error and the No cancellations hint.
- **Done (later):** Approved #35 at 468cf23 after rendering at 375 and 1280 px (About placeholders, the #31 follow-ups). Nit: the header says "Draft saved" while an invalid email isn't saved. S1-1 to S1-4 are design-approved.
- **Done (later):** Attendee contact email, agreed with PM and Security: show the viewer's own email in the field, counted only once saved; no api fallback; publish refused without a saved email (checklist item). Copy in copy-s0-s2.md, rule in handoff-s1.md. Approved FrontendDev's two new strings (offline remove alert, "Use a whole number").
- **Done (later):** Re-approved #35 at bda956e: the whole-number error, focus kept on a mistake, the offline remove alert, offline ticket edits.
- **Done (later):** #35 passes at d966e09 (the save-error header, Saving… during a venue lookup) and at 16103ea (Publish sends pending edits first; the api's missing list uses the same copy).
- **Next:** Review S1-5 (browse, artboard 1) when it opens. Check the contact email change when it's pushed.
- **Blocked:** Nothing.

## 15 Oct 2026

- **Done:** Design review of [PR #17](https://github.com/rojandhimal/onetickets/pull/17) (S1-1 wizard): changes needed. Must fix: banner upload missing from Basics; autosave can show "Draft saved" after dropping a rejected field and "Saved on this phone" on a server error; stepper tap targets are 24 px. Four smaller copy fixes. copy-s0-s2.md updated (overnight "Ends the next day", Finance/Door staff notice). S1-4 empty-access copy updated for the privacy ruling.
- **Next:** Re-review #17 when pushed. Also done today: Sprint 10 designs (first-run guide, founding offer, CSV import, data and account, status page, empty-states sheet), canvas v29, [handoff-s10.md](../../design/handoff-s10.md).
- **Done (later):** Re-reviewed #17 at ae1cc66: approved from design. Answered FrontendDev's copy questions: the refused-field header is "Couldn't save one field. Check the message under it.", and HEIC is dropped from the banner copy. Updated copy-s0-s2.md.
- **Done (later):** Defined the browse When chips (Tonight, This weekend, Next 7 days) in handoff-s1.md S1-5 for QA's #16 question, and told BackendDev and PM.
- **Next:** Review S1-2 to S1-5 as they open.
- **Blocked:** Nothing.

## 10 Oct 2026

- **Done:** Stopped pausing, as tegs asked. Sprint 7 designed: Payouts (with bank-change, Stripe-check and dispute holds), Settlement report with CSV and Xero downloads, and the Admin console (look up and act, review queue, Stripe check), canvas v25. Handoff: [handoff-s7.md](../../design/handoff-s7.md). Sprints 8 and 9 designed too: wallet pass, share kit (A4 poster, story image), Companion Card, an accessibility audit checklist, the waiting room (including the ARCH-2 "all held" state) and on-sale settings, canvas v26. Handoff: [handoff-s8-s9.md](../../design/handoff-s8-s9.md).
- **Next:** Sprints 1 to 9 are designed. Added PM's S7 fixes (step-up MFA, configurable hold pending tegs, SEC-8 emails, ARCH-1; canvas v27) and "leave out for now" lists to handoff-s1 and handoff-s2. Reviewed the S1 contract draft: two privacy conflicts sent to FrontendDev (public online link, public contact email). Next: review S1-1 as it builds, then handoff-s10 onboarding.
- **Blocked:** Nothing. Still waiting on tegs for the banner, gift card and canvas-sharing answers.

## 9 Oct 2026

- **Done:** Designed Sprints 0 to 6 on the [OneTickets UI Design canvas](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv) (version 23, 24 artboards). Handoffs: [S0](../../design/handoff-s0.md) (all 7 fixes shipped in FrontendDev's PR #2), [S1](../../design/handoff-s1.md), [S2](../../design/handoff-s2.md), [S3 door scanner](../../design/handoff-s3.md), [S4 paid checkout, fees, SEC-1, ARCH-1](../../design/handoff-s4.md), [S5 and S6](../../design/handoff-s5-s6.md). Final copy for S0 to S2 screens and emails: [copy-s0-s2.md](../../design/copy-s0-s2.md). Research: [recruitment pack](../../research/recruitment-pack.md), [session notes template](../../research/session-notes-template.md), [usability test plan](../../research/usability-test-plan-s1-s2.md).
- **Next:** Paused until the 13 Nov demo and interview feedback, then update the canvas and handoffs from the findings.
- **Blocked:** Nothing. Waiting on tegs for three answers: the organiser banner on the event page (designed as yes), an extra A$30 gift card per usability session, and sharing the private canvas versus screen-sharing it.
