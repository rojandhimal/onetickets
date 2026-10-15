# Design handoff: Sprint 3 (check in at the door)

Owner: ProductDesign. Canvas: [OneTickets UI Design](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), version 20. Base tokens: [handoff-s0.md](handoff-s0.md).

The door screens use a dark theme for glare and battery: ground #0F0F14, surfaces #1E1E26 and #2A2A33, field border #7A7A88, secondary text #B9B9C6. **Focus ring on dark is inverted**: 2 px white outline, 2 px offset, 2 px #0F0F14 halo. Result screens keep the rule from the design system: green and amber take ink text, red takes white, and each result also differs by icon, sound and vibration.

## S3-1 Door staff sign-in

Artboards **9c Live check-in (organiser)** for the invite, **9a Door staff** (lever `step`: invite, pick, ready).

- Owner invites from the event's Check-in tab: email plus role (Door staff default; Admin and Finance listed for S0-4's roles). Status line "Invite sent to …".
- Invite link opens 9a "invite": who invited them, what they can and can't see, email, "Email me a sign-in link" (magic link, same as organisers).
- "pick": today's and upcoming events for that organisation only, as radio cards; door name chips (Main door, Side gate, Box office) plus "Other…" which reveals a text field. The door name is stored on the device and shown on every scan.
- Door staff never see the organiser nav, sales or money. Their only screens are 9a and 9b.

## S3-2 Scan a QR code

Artboard **9b Door scanner** (prototype buttons simulate scans; don't build them).

- Camera full screen in the frame, viewfinder corners, hint "Point at the ticket's QR code". Scanning is continuous; no shutter button.
- Results take over the whole screen with `role="alert"`, and focus moves to "Scan next guest". Valid: green, tick, "Admit 1", name, ticket type. Already in: amber, "!", "Already in", name, "Scanned at 9:52 am at Main door. Check ID before letting them in." Not valid: red, cross, "Not valid", reason (refunded, cancelled, wrong event, not a OneTickets ticket), "Do not admit. Offer to look them up by name if they think this is wrong."
- Sounds: valid one short high tone; already in two mid tones; invalid one low buzz. Vibration: 80 ms / 80-80-80 ms / 400 ms. Honour the device's silent switch for sound but always vibrate.
- Valid results auto-dismiss after 1.5 s (the next scan can start); amber and red stay until "Scan next guest" is pressed.

## S3-3 Offline mode

- 9a "ready" downloads, with a progress bar and a checklist: tickets and guest names, the signing key, refunded and cancelled tickets, check-ins from other doors. "Start scanning" appears when all four are done. Hint: "Do this on Wi-Fi before doors."
- 9b header badge: "Online" (green dot, #14351F ground) or "Offline" (amber dot, #3D2A08 ground) plus "{n} to sync" next to the count. Tap the badge in the prototype to switch.
- When back online, unsynced scans upload within 10 s; the sync banner (amber, `role="status"`, dismissable) says "Synced 3 scans." and, when another door admitted the same ticket while offline, "1 ticket was also admitted at Side gate while offline; it is flagged for the organiser." Door staff take no action on it.

## S3-4 Name search fallback

- "Find guest by name" opens search over the downloaded list (works offline). Each result: name, ticket type, masked email (j•••@example.com). Not yet in: green "Check in" button. Already in: amber "In" with the time.
- Checking in by name shows the same full-screen green result as a scan and records the same check-in.

## S3-5 Live check-in count

- 9b header: "{count} of 40 checked in", `aria-live="polite"`, refreshed at least every 10 s while online.
- 9c (organiser): big count against tickets issued with a progress bar and "last at …" time; a "Doors" list with each door's staff, phones, admitted count and online/offline (offline shows a hollow amber dot and "{n} to sync", so state isn't colour only); a marigold-tint "1 ticket let in twice" card after sync with ticket ref, holder, both doors and times, and "Mark as checked".
- "Scan tickets on this phone" lets the organiser scan too (goes to 9a).
