# Usability test plan: publish an event, get a free ticket

**Owner:** ProductDesign. **Runs it:** tegs (moderator), with a note-taker if possible.
**What we test:** the clickable prototype on the [OneTickets UI Design canvas](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv) for Sprint 1 (create and publish an event, event page, browse) and Sprint 2 (free checkout, ticket, My tickets). Specs: [handoff-s1.md](../design/handoff-s1.md), [handoff-s2.md](../design/handoff-s2.md).
**When:** Mon 9 to Thu 12 Nov 2026, so findings land before Sprint 1 starts on 16 Nov. Top-line findings go into the Sprint 0 demo readout on Fri 13 Nov.
**Who:** 5 organisers and 5 attendees from the discovery recruits ([discovery-interview-guide.md](discovery-interview-guide.md), section 2). Five per group finds most of the serious problems.

Defaults to confirm: separate 30-minute sessions (not added onto the discovery interview, which is already full), with an extra A$30 gift card each. Ask at the end of each discovery interview: "Would you try out an early version for 30 minutes next week?"

---

## 1. What we need to learn

| #   | Question                                                                  | Pass if                                                                         | Story         |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- |
| U1  | Can an organiser publish a free event from a template without help?       | 4 of 5 publish unaided, median under 10 minutes                                 | S1-1, S1-2    |
| U2  | Do organisers understand the publish checklist when something is missing? | 4 of 5 find and fix the missing venue within 1 minute                           | S1-1          |
| U3  | Do organisers trust that the draft is saved?                              | 4 of 5 can say where to find the draft after closing it                         | S1-1 autosave |
| U4  | Can an attendee decide from the event page alone?                         | 4 of 5 state date, place, price, cancellation and access info without scrolling | S1-3, S1-4    |
| U5  | Can an attendee get a free ticket fast with no account?                   | 4 of 5 finish in under 90 seconds; none look for a sign-up                      | S2-2          |
| U6  | Do attendees know where their ticket is later?                            | 4 of 5 find it again via My tickets or the email link                           | S2-4          |
| U7  | Does the hold message reassure rather than rush?                          | No one describes feeling rushed or timed                                        | S2-1, S2-2    |
| U8  | Do browse filters match how people look for things to do?                 | 4 of 5 find "something free this weekend" first try                             | S1-5          |

## 2. Set-up

- **Format:** video call. The participant drives on their own phone where possible (the canvas link opened in their mobile browser), otherwise on the moderator's shared screen with the participant saying where to tap.
- **Sharing the canvas:** the canvas is private. Before sessions, tegs either shares view access through the canvas's Share menu, or screen-shares a "focused" artboard so nothing else on the canvas shows. Open each flow at its starting artboard (organisers: 0b; attendees: 1 Discover).
- **Prototype limits to tell participants:** typing works but nothing saves, some buttons are pretend, and "Prototype:" buttons are for us. If they tap something that does nothing, ask "What did you expect to happen?" and move on.
- **Levers to set beforehand** (properties panel): Event page `showBanner` on; Review `missingVenue` on for task O3 only; Checkout `scenario` default; My tickets `signedIn` off for task A4.
- **Accessibility:** ask in advance about captions, larger text or a screen reader. For screen-reader users, use the live prototype on their own device and note where the reading order or labels confuse them.
- **Consent:** reuse the discovery consent note (recruitment pack, section 6), with "trying out an early version" added. Record the screen and voice only.

## 3. Script: organisers (30 minutes)

**Intro (3 min).** "We're testing the design, not you. Anything confusing is our fault and exactly what we need to hear. Please think out loud as you go."

**O1 Publish (10 min).** "You're running [their real kind of event, from the interview] next month. It's free, about 40 people. Get it set up and published so you could share the link." Start at 0b. Don't help. Note: template chosen, time to publish, hesitations at Where (venue lookup), Tickets, Details, Review.

- Follow-up: "What do you think attendees will see?" "Was anything you expected missing?"

**O2 Leave and come back (3 min).** Midway through O1 (at step 2), say: "Your phone rings. Close this." After 30 seconds: "Where would you find what you'd done?" Watch for the X and "Draft saved".

**O3 Missing venue (4 min).** Set `missingVenue` on the Review artboard. "You're ready to publish. Go ahead." Note: do they notice the alert, find the "Add" link, understand they're blocked rather than broken.

**O4 Event page check (4 min).** Open artboard 2. "This is your event page. Anything you'd change before sharing it?" Probe the banner (tegs's open question): "Would you upload a banner? What would you use?"

**Wrap-up (6 min).** Single Ease Question per task (1 to 7, "How easy was that?"). "If you could change one thing, what would it be?" "Compared with what you use now?"

## 4. Script: attendees (30 minutes)

**Intro (3 min).** As above.

**A1 Find something (5 min).** Start at 1 Discover. "It's Wednesday. Find something free to do this weekend near you." Note: chip use, whether they look for search, what they read on cards.

**A2 Decide (5 min).** On the event page: "Without scrolling, tell me: when, where, how much, can you cancel, can you get in with a wheelchair?" Then: "Would you go? What else would you want to know?"

**A3 Get tickets (6 min).** "Get tickets for you and a friend." Checkout, then the ticket. Time it. Note reactions to the hold message, no account, and the opt-in box.

- Probe: "How long do you think you had to finish?"

**A4 Find it again (5 min).** Set My tickets `signedIn` off. "It's the day of the event, on a different phone. Get to your ticket." Note whether they think of the email link, and how they react to "Find your tickets".

**Wrap-up (6 min).** Single Ease Question per task. "What would make you trust a ticket site you haven't used before?" "Anything that would stop you booking here?"

## 5. Notes and scoring

Use [session-notes-template.md](session-notes-template.md) with these tags in place of the hypothesis tags: U1 to U8, plus SEV1 (blocks the task), SEV2 (slows or confuses but they recover), SEV3 (cosmetic or a suggestion).

Per task, record: completed unaided / with a hint / not completed; time; Single Ease Question score; the quote that best explains any struggle.

| Task                         | P1  | P2  | P3  | P4  | P5  | Pass? |
| ---------------------------- | --- | --- | --- | --- | --- | ----- |
| O1 publish (time)            |     |     |     |     |     |       |
| O2 find draft                |     |     |     |     |     |       |
| O3 fix missing venue         |     |     |     |     |     |       |
| A1 find free this weekend    |     |     |     |     |     |       |
| A2 five facts above the fold |     |     |     |     |     |       |
| A3 two free tickets (time)   |     |     |     |     |     |       |
| A4 find ticket again         |     |     |     |     |     |       |

## 6. After the sessions

- **Thu 12 Nov:** list every issue with severity and how many participants hit it. A SEV1 seen twice, or any issue seen by 3 or more, is a must-fix before the story is built.
- **Fri 13 Nov:** one-page readout in the Sprint 0 demo next to the discovery top-line: pass/fail per U-question, top 5 issues with a quote each, and the proposed design change.
- ProductDesign updates the canvas and the handoffs; changes to stories go to PM as new or changed cards.
- Send tegs's answer on the banner question (O4 evidence) to the UI design thread.
