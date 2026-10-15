# OneTickets discovery interview guide (research round 1)

**Round:** Human-centred design research round 1, "Discover"
**When:** Sprint 0, Mon 2 to Fri 13 November 2026
**Who:** 8 organisers (4 Sydney, 4 Melbourne) and 6 attendees, plus one live event door observation
**Feeds:** validated personas and journeys, and the top 5 pain points ([OneTickets: Human-Centred Design](https://claude.ai/code/artifact/db49be1a-3dfa-44c6-b396-c74f6f37ff67), Research and validation plan, round 1)
**Backlog link:** [OneTickets MVP Sprint Backlog](https://claude.ai/code/artifact/908caae3-7868-4e89-9a10-4da3f5d376ae), Sprint 0. Full synthesis happens in the buffer week (14 to 18 Dec); a top-line readout is due at the Sprint 0 demo on Fri 13 Nov.

---

## 1. What this round must answer

The five personas (Priya, Tom, Mei, Jordan, Helen) are hypotheses built from the business plan. This round checks them before the team builds on them. Every interview question below traces back to one of these hypotheses, and each hypothesis names the backlog work that changes if it turns out wrong.

### Organiser hypotheses

| #   | We believe                                                                                               | Persona    | Backlog it affects if wrong                       |
| --- | -------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------- |
| O1  | Small organisers pick a ticketing tool mainly on fees, and fees eat their margin                         | Priya, Mei | S4-2 fee calculator, pricing model                |
| O2  | Organisers will start with only an email and add ABN and bank details later                              | Priya, Mei | S0-3 sign-up, S4-1 Stripe onboarding              |
| O3  | If setup takes longer than an evening, small organisers fall back to a Google Form and bank transfer     | Priya, Mei | S1-1 wizard, 10-minute publish target             |
| O4  | Organisers want to see buyer price and their own net per ticket before publishing, and most pass fees on | Priya, Tom | S4-2 (fees passed on by default)                  |
| O5  | Slow payouts are a real pain, and a known payout date matters more than a fast one                       | Priya      | S7-1 post-event payouts, Phase 2 weekly payouts   |
| O6  | The door is where things go wrong: queues, fake tickets, poor reception, one scanning device             | Tom        | Sprint 3 scanner, offline mode                    |
| O7  | Scalpers and resale are a top concern for gig promoters                                                  | Tom        | S9-2 bot protection, Phase 2 transfer and resale  |
| O8  | Volunteer organisers worry about handling money and need a clean handover to the next volunteer          | Mei        | S6-4 CSV, S6-6 co-organiser access                |
| O9  | Recurring events (monthly workshops, class series) are a must-have, not a nice-to-have                   | Priya      | Phase 2 recurring events (currently after launch) |
| O10 | Organisers need settlement reports their venue and accountant accept                                     | Tom        | S7-2 settlement report, Phase 2 Xero sync         |
| O11 | Organisers answer attendee emails about refunds and invoices by hand today                               | Priya      | S5-1 invoices, S5-3 refunds                       |

### Attendee hypotheses

| #   | We believe                                                                                         | Persona                 | Backlog it affects if wrong                                 |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| A1  | Most people find events through Instagram, friends or Google, and buy on their phone               | Jordan                  | Mobile-first principle, S1-3 event page, S1-5 browse        |
| A2  | Fees revealed at checkout make people distrust the seller or abandon the purchase                  | Jordan, Helen           | All-in price everywhere, S4-2                               |
| A3  | Being forced to create an account makes people give up                                             | Jordan                  | S2-2 guest checkout                                         |
| A4  | Tickets get lost in email, and people would rather keep them in a phone wallet                     | Jordan                  | S2-4 My tickets, S8-1 wallet passes                         |
| A5  | The refund policy affects whether people buy                                                       | Jordan, Helen           | S5-2 refund policy at purchase                              |
| A6  | People with access needs cannot find venue accessibility details and are hurt by checkout timeouts | Helen                   | S1-4 accessibility details, S8-3 Companion Card, S8-4 audit |
| A7  | People who book for a group want seats together and an easy way to pass tickets on                 | Helen, Jordan           | Phase 2 transfer; reserved seating stays Phase 3            |
| A8  | Free RSVPs often turn into no-shows, which organisers notice                                       | Jordan (and organisers) | Sprint 2 free tickets                                       |
| A9  | A "verified organiser" signal and Australian support raise trust on a site people don't know       | Jordan, Helen           | Trust signals on the event page                             |

**Rule for interviewers:** we are testing these, not selling them. A participant who says "fees don't bother me" is a finding, not someone to persuade.

---

## 2. Who to recruit

### Organisers (8)

| Slot | Profile                                                                                                                                                 | Persona it tests | City split            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------- |
| 3    | Community or small-business organisers running regular events of 20 to 200 people (workshops, classes, meetups, markets), usually alongside another job | Priya            | 2 Sydney, 1 Melbourne |
| 3    | Promoters or venue staff running ticketed gigs, club nights or shows of 300 to 2,000 people                                                             | Tom              | 1 Sydney, 2 Melbourne |
| 2    | Volunteers running occasional events for a school, sports club, charity or community group                                                              | Mei              | 1 Sydney, 1 Melbourne |

Mix within the 8:

- At least 2 who currently use Eventbrite, at least 2 on another platform (Humanitix, TryBooking, Moshtix, Oztix or similar), and at least 2 using a Google Form, bank transfer or cash.
- At least 2 who mostly run free events.
- At least 1 who has stopped using a ticketing platform in the last year (ask why).
- Ideally, 2 or 3 of them are open to becoming founding organisers for sprint demos (see board risk R3). Ask about this at the end, never at the start, so it does not colour their answers.

### Attendees (6)

| Slot | Profile                                                                                                                                                                  | Persona it tests        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 3    | Aged 18 to 35, bought a ticket to a local event on a phone in the last 3 months                                                                                          | Jordan                  |
| 2    | Aged 60 or over who book for themselves and others; at least 1 uses assistive technology (screen magnifier, screen reader, large text) or has a mobility or hearing need | Helen                   |
| 1    | Books events for a group or for work (team night, conference, needs a tax invoice)                                                                                       | Group or business buyer |

Mix: 3 Sydney and 3 Melbourne. At least 1 attendee has abandoned a ticket purchase partway through in the last 6 months.

### Screener questions

Organisers:

1. In the last 12 months, how many events have you organised where people needed a ticket or had to register? (Screen out: none.)
2. Roughly how many people came to your most recent one?
3. How did people get tickets or register? (Platform name, form, bank transfer, cash, other.)
4. Is organising events part of your paid job, a side business, or volunteer work?
5. Which suburb or city were your events in? (Need Sydney or Melbourne.)
6. Do you work for a ticketing company or event-tech company? (Screen out: yes.)

Attendees:

1. In the last 3 months, have you bought or registered for a ticket to a local event (gig, workshop, class, meetup, show, school or club event)? (Screen out: no.)
2. What device did you use to get the ticket?
3. Your age range.
4. Do you use any settings or tools that help you see, hear or use your phone or computer, or do you have any access needs when going to venues? (Optional; used to fill the Helen slots.)
5. Do you ever book for a group or for work?
6. Do you work in ticketing or events? (Screen out: yes.)

### Where to find them

Personal networks of the founder, local Facebook and community groups, venue contacts in Fitzroy and Marrickville, school P&C and sports club contacts, and Instagram accounts of small local event series. For the Helen slots, a disability advocacy or seniors' group is the most reliable route; offer to pay the organisation as well as the participant if they ask.

### Incentive (default, change if the budget differs)

A$80 gift card for organisers (60 minutes) and A$50 for attendees (45 minutes). Offer the incentive whether or not the session is cut short.

---

## 3. Logistics, consent and privacy

**Format.** Video call by default (Google Meet or Zoom), so participants can share their screen and show their current tools. In person is better for the Helen slots if the participant prefers it, and for any organiser who wants to show printed material. Two people per session where possible: one interviewer, one note-taker.

**Length.** Organisers 60 minutes, attendees 45 minutes. Leave 15 minutes after each session for the debrief form (section 8).

**Schedule.**

| Days                           | Sessions                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Mon 2 to Fri 6 Nov             | 8 organiser interviews (no more than 3 a day)                                              |
| Mon 9 to Wed 11 Nov            | 6 attendee interviews                                                                      |
| One event night in either week | Door observation (section 7), ideally at an event run by one of the organiser participants |
| Thu 12 Nov                     | Affinity mapping of debrief forms; draft top-line findings                                 |
| Fri 13 Nov                     | Top-line readout at the Sprint 0 demo                                                      |

**Consent.** Send a plain-English consent note with the booking and confirm it on the recording at the start. It covers:

- what the research is for and who will see it (the OneTickets team only);
- that the session is recorded and transcribed, and that they can say no to recording and still take part with written notes only;
- that they can skip any question or stop at any time and still get the incentive;
- that quotes used in reports are anonymised (first name changed, no business name);
- how long recordings are kept (default: deleted at the end of the buffer week, 18 Dec 2026, once synthesis is done) and how to ask for deletion sooner.

**Privacy (Australian Privacy Principles).** Collect only what the research needs. Do not ask for revenue figures as exact numbers; ranges are enough. Keep recordings and screener answers out of the shared project folder; store them in one access-controlled location, with participant codes (O1 to O8, A1 to A6) used in all notes. If a participant shows a screen with their attendees' names or emails, ask them to scroll past it and do not capture it.

**Accessibility of the session itself.** Ask every participant in advance whether they need anything to take part: captions, a phone call instead of video, larger shared text, extra time or breaks. For the Helen slots, offer to run the session on the device and setup they normally use.

---

## 4. Interviewer guidance

- **Ask about the last time, not "usually".** "Tell me about the last event you ran" gets real behaviour; "what do you usually do" gets ideals.
- **Ask them to show you.** If they have their current tool open, a past event page, a confirmation email or a spreadsheet, ask to see it. What people do on screen beats what they say.
- **Don't pitch.** Do not describe OneTickets features before the wrap-up. If asked, say "I'd love to tell you at the end, but I don't want to steer your answers."
- **Don't lead.** Say "How did you feel about the fees?" not "Were the fees annoying?" Don't name a pain point before they do.
- **Follow the energy.** If a participant lights up or gets frustrated, stay there with "Tell me more about that" and "What happened next?" It's fine to skip sections to do so; the must-ask questions are marked ★.
- **Probe for numbers and workarounds.** "How long did that take?", "What did you do instead?", "Who else got involved?"
- **Silence is a tool.** Wait 3 seconds after an answer before moving on.
- **Note the exact words.** Pain points in the participant's own language become copy and test tasks later.

Standard probes:

- "Can you walk me through exactly what you did?"
- "What were you expecting to happen?"
- "Why was that important to you?"
- "How did you work around it?"
- "If you could change one thing about that, what would it be?"

---

## 5. Organiser interview (60 minutes)

### Intro (3 min)

> Thanks for making the time. I'm [name], and I'm helping a small Australian team understand how people run events and sell or give out tickets today. There are no right or wrong answers. We're not testing you, and you won't hurt anyone's feelings: we want to hear what's frustrating as much as what works.
>
> We'd like to record this so we can focus on talking rather than writing. Only our team will hear it, and we'll delete it by the end of December. Is that OK? You can skip anything or stop at any time.

Start recording and confirm consent on the recording.

### Warm-up (5 min)

1. Tell me a bit about the events you run. What are they, who comes, and how often?
2. How did you get into running them?
3. Is this your job, a side business, or volunteer work? Roughly how many hours a week does it take?

### Section A: The last event, start to finish (10 min) ★

This is the backbone of the interview. Get the story of one real, recent event before going into topics.

4. ★ Think about the last event you ran where people needed a ticket or had to register. Walk me through it, from when you decided to run it to after it was over.
   - Probe for each step they mention: what tool, who did it, how long it took, what went wrong.
5. ★ Which part of that took the most time or caused the most stress?
6. If you ran the same event next month, what would you do differently?

(Map what they say onto the journey stages in the notes template: sign up, create, price, promote, manage, door, settle.)

### Section B: Choosing and setting up a tool (8 min). Tests O1, O2, O3

7. ★ How did you end up using [their current tool or method]? What else did you consider?
8. What made you pick it over the others? (Listen for fees, ease, what others use, payout speed. Don't offer options.)
9. Have you ever switched tools or given up on one? What happened?
10. ★ Think back to setting up your first event on it. How long did it take, from signing up to the event being live?
    - Probe: Did you finish in one sitting? Where did you get stuck?
11. When you signed up, what did it ask for? How did you feel about giving business details or bank details at that point? (O2)
12. For those using a form or bank transfer: what stops you from using a ticketing platform? (O3)

### Section C: Pricing and fees (8 min). Tests O1, O4

Skip to 15 if they only run free events.

13. ★ How do you decide on a ticket price?
14. ★ What do you know about the fees on your ticket sales today? Can you show me where you see them?
    - Probe: Do you pass fees on to buyers or absorb them? Why?
    - Probe: How do you work out what you actually take home?
15. Have attendees ever commented on the fees or the final price? What did they say?
16. For free events: do you charge anything at all, such as a donation or a deposit? Do people who register actually turn up? (A8)

### Section D: Getting the word out (4 min)

17. How do people find out about your events?
18. What do you share: a link, a poster, an Instagram post? Show me the last one if you can.
19. How do you know whether it's working? When do you start to worry about sales?

### Section E: Before the event (5 min). Tests O8, O11

20. ★ Between publishing and the day itself, what do attendees contact you about?
    - Probe: refunds, invoices or receipts, changing names, lost tickets, accessibility questions.
21. How do you handle a refund request today? Walk me through the last one.
22. Have you ever needed to change the date, time or venue after people had bought tickets? What happened?
23. Does anyone else help you run things? How do you share access or hand over? (O8)

### Section F: On the day, at the door (8 min). Tests O6, O7

24. ★ Tell me about the door at your last event. Who checked people in, and how?
    - Probe: printed list, phone app, QR scanning, names on a clipboard, nothing.
    - Probe: how many people or devices were on the door? How long was the queue at its worst?
25. ★ What has gone wrong at the door at any of your events? (Listen for: no signal, dead phones, fake or duplicate tickets, people not on the list, scanner problems.)
26. What's the reception and wifi like at your venues?
27. Tom slots only: Have you had problems with scalpers, resold tickets or bots buying up tickets? What did you do about it? (O7)

### Section G: After the event and getting paid (5 min). Tests O5, O10

Skip money questions for free-only organisers; ask about follow-up instead.

28. ★ When do you get your money from ticket sales, and how do you know when it's coming?
    - Probe: Has a payout ever been late or held? How did that affect you?
29. What reports or records do you need afterwards, and who for (venue, accountant, committee, the next volunteer)?
    - Probe: Show me what you export or send, if you can.
30. Do you need to give buyers tax invoices? How do you handle GST?

### Section H: Recurring and persona-specific (3 min)

31. Priya slots: Do you run the same event on a schedule? How do you set that up each time? What would it mean if you could only create one date at a time? (O9)
32. Mei slots: What worries you most about being responsible for the ticket money? What would the next volunteer need from you to take over? (O8)
33. Tom slots: What does the venue ask from you after a show? (O10)

### Wrap-up (2 min)

34. ★ If you could wave a magic wand and fix one thing about how you sell tickets and run your events, what would it be?
35. Is there anything I should have asked you but didn't?

Stop recording, then:

> Thank you. That's really useful. In a sentence: we're building a simpler Australian ticketing platform for local organisers, with the full price shown up front and fast payouts. We'll be showing early versions to a few organisers every two weeks from November. Would you be open to being one of them? (Note their answer for founding-organiser recruitment.)

Confirm the incentive and how it will be sent.

---

## 6. Attendee interview (45 minutes)

### Intro (3 min)

> Thanks for joining. I'm [name], and I'm helping a small Australian team understand how people find and buy tickets to local events. There are no right or wrong answers, and we're interested in what annoys you as much as what works.
>
> Can we record this? Only our team will hear it, and we'll delete it by the end of December. You can skip anything or stop at any time.

Start recording and confirm consent on the recording. For assistive-technology users, ask if they'd be happy to use their usual setup when showing anything on screen.

### Warm-up (3 min)

1. What kinds of events do you go to? How often?
2. Who do you usually go with?

### Section A: The last ticket you got (10 min) ★

3. ★ Tell me about the last time you got a ticket to a local event. How did you first hear about it?
4. ★ Walk me through getting the ticket. Where were you, what device were you on, and what did you do step by step? (A1)
   - If they can, ask them to open the site or confirmation email and show you.
5. ★ Was there any moment where you hesitated or nearly gave up? What was going on? (A2, A3)
6. How long did it take, roughly?

### Section B: Deciding whether to go (6 min). Tests A2, A5, A9

7. ★ When you're looking at an event page, what do you check before you decide?
8. ★ Have you ever been surprised by the price at the end of buying a ticket? What happened, and what did you do? (A2)
9. Do you look at the refund policy before buying? Has it ever changed your mind? (A5)
10. When it's a site or organiser you haven't heard of, how do you decide whether to trust it? (A9)

### Section C: Buying (6 min). Tests A3

11. Have you ever had to create an account to get a ticket? How did you feel about it?
12. How do you prefer to pay on your phone? (Don't list options.)
13. ★ Tell me about a time a ticket purchase didn't work out or you abandoned it. (A3)
14. For group or work bookers: How do you book for several people? Do you need an invoice or receipt? What happens if someone drops out? (A7)

### Section D: Keeping the ticket and getting in (8 min). Tests A4

15. ★ After you buy, where does your ticket live? Show me where your last one is now. (A4)
16. Have you ever had trouble finding your ticket or getting in at the door? What happened?
    - Probe: dead phone, no signal, can't find the email, ticket in someone else's name.
17. Have you ever needed to give a ticket to someone else? How did that go? (A7)
18. For free events you registered for: did you go? If not, what happened? (A8)

### Section E: Access needs (5 min). Tests A6. Ask for the Helen slots; ask others only if they raised access needs

19. ★ Before you go to a new venue, what do you need to know? Where do you look for it?
20. ★ Has anything on a ticketing site made it hard to buy? (Probe: small text, things moving, time limits, forms, captchas.)
21. Have you used a Companion Card or needed a carer or companion ticket? How did that work?
22. Have you ever called a venue or organiser because you couldn't find information online? What happened?

### Wrap-up (4 min)

23. ★ If you could change one thing about buying tickets to local events, what would it be?
24. Anything I should have asked but didn't?

Stop recording, thank them, and confirm the incentive.

---

## 7. Live door observation (one event)

Pick an event of 100 people or more, ideally run by an organiser participant, with the organiser's permission. Arrive 30 minutes before doors and stay until the queue clears. Do not photograph attendees or screens showing personal data.

Watch for and record:

| What                                                                        | Note |
| --------------------------------------------------------------------------- | ---- |
| Check-in method (scan, list, wristband, nothing)                            |      |
| Number of staff and devices on the door                                     |      |
| Mobile signal and wifi at the door (check your own phone)                   |      |
| Longest queue length and longest wait (time a few people end to end)        |      |
| Average seconds per person once at the front (time 10 people)               |      |
| Problems: ticket not found, dead phone, duplicate, wrong event, not on list |      |
| How problems were resolved and how long each took                           |      |
| What staff had to look up or ask the organiser about                        |      |
| Walk-ups, door sales and how they were handled                              |      |
| Access: step-free entry, companions, how staff helped people who needed it  |      |

After doors, ask the door staff for 5 minutes: "What was hardest tonight?" and "What usually goes wrong?"

This feeds the door scan time target (under 2 seconds per attendee) and Sprint 3.

---

## 8. Notes and debrief

### During the session

The note-taker logs observations with the participant code and a rough timestamp, and tags each line with the hypothesis it touches (O1 to O11, A1 to A9) or NEW for anything unexpected. Exact quotes go in quotation marks.

### Debrief form (fill within 15 minutes of each session)

```
Participant code:            Date:            Interviewer:          Note-taker:
Persona fit (Priya / Tom / Mei / Jordan / Helen / group buyer / none):
City:                        Current tool(s):

Top 3 things we learned:
1.
2.
3.

Hypotheses:   supported / challenged / no evidence   (one line each, with the quote)
O1 ...  O11   or   A1 ... A9

Biggest pain point, in their words:

Workarounds seen:

Surprises (NEW):

Persona notes (what the persona gets wrong about this person):

Founding organiser interest (organisers only):  yes / maybe / no
```

### Synthesis

- **Thu 12 Nov:** affinity-map the 14 debrief forms and the door notes. Group by journey stage, then by hypothesis. Count how many participants support or challenge each hypothesis.
- **Fri 13 Nov top-line readout** (one page, for the Sprint 0 demo): the hypotheses that were clearly challenged, the top 5 pain points with a quote each, and any finding that should change Sprint 1 or 2 stories before they start.
- **Buffer week (14 to 18 Dec):** full synthesis with transcripts, updated personas and journeys in the Human-Centred Design doc, and new or changed cards sent to PM for the backlog.

### What counts as a signal

With 8 organisers and 6 attendees, treat a pattern as real when it shows up in at least 3 organisers or 3 attendees, or in every participant of one persona slot. A single strong story is worth reporting as a quote, but not as a reason to change the backlog on its own.
