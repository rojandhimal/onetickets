# Design handoff: S0-3 sign-up and empty organiser home

Owner: ProductDesign. Source of truth: [OneTickets UI Design canvas](https://claude.ai/artifact/WZa21VJz8uyaJDJQFueSMv), artboards **0a Organiser sign-up** and **0b Organiser home, no events yet**, plus the **Design system** board (Ticket stub v0.1).
Written 8 Oct 2026 against FrontendDev's branch `claude/frontend-2jar9t`. Where the branch already matches, this doc says so; items marked **Change** or **Add** are the only things to act on.

## 1. Tokens

Your `globals.css` names are the canonical names from now on. Values match the canvas. Add the two marked rows.

| Token                                | Value             | Use                                                              |
| ------------------------------------ | ----------------- | ---------------------------------------------------------------- |
| `--indigo`                           | #4338CA           | Primary action, links (7.9:1 on white)                           |
| `--indigo-hover`                     | #3730A3           | Hover and pressed on indigo                                      |
| `--indigo-tint` / `--indigo-ink`     | #EEF0FF / #2E2799 | Info notices                                                     |
| `--marigold`                         | #FFB547           | Organiser CTA and highlights. Ink text only, never white         |
| `--marigold-tint` / `--marigold-ink` | #FFF4E0 / #5C3300 | Warm notices (paid tickets hint)                                 |
| `--ink` / `--ink-soft`               | #16161D / #33333F | Text, organiser header / body copy                               |
| `--slate`                            | #5B5B6B           | Secondary text (6.3:1 on paper)                                  |
| `--mist`                             | #B9B9C6           | Secondary text on ink only (never on white)                      |
| `--paper` / `--white`                | #F7F7FA / #FFFFFF | App ground / cards and fields                                    |
| `--line-field`                       | #8A8A9A           | Input and Google button borders (3.4:1, meets 3:1)               |
| `--line-button`                      | #D4D4DE           | Secondary button outlines, dividers between options              |
| `--line-divider`                     | #E4E4EC           | Card borders, header rules                                       |
| `--error`                            | #B91C1C           | Error text and invalid field border                              |
| **Add** `--error-tint`               | #FDECEC           | Error notice ground (you have it inline; #B91C1C on it is 5.7:1) |
| **Add** `--success-ink`              | #0B5A3A           | "Draft saved", ticks (needed from S1-1 on)                       |

Type: Bricolage Grotesque for headings and prices, Figtree for everything else. Scale: Display 32/800, Page title 28/800, Section 22/700, Body 16/400 (inputs always 16 so iOS never zooms), Label 14/600, Small 13 to 14/400. Nothing under 12 px.

Spacing on a 4 px grid (4, 8, 12, 16, 20, 24, 32, 48). Gutter 16. Radius: 12 inputs and small buttons, 14 primary buttons, 16 cards, 999 chips and round icons.

## 2. Focus ring

Already right in `globals.css`: `outline: 2px solid var(--ink); outline-offset: 2px; box-shadow: 0 0 0 2px var(--white)`. It reads on paper, white, indigo and ink.

- **Change:** on the ink header (the "View site" link on 0b), the ink outline disappears against #16161D. Inside `.header`, use `outline-color: var(--white); box-shadow: 0 0 0 2px var(--ink)`.
- Focus targets that are moved to by script (the "Check your email" heading) get `tabindex="-1"` and no visible ring, which you already do.

## 3. Components used on 0a and 0b

| Component         | Spec                                                                                                                                                                                                            | Branch status                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Primary button    | 54 high, radius 14, indigo, white 17/700, full width                                                                                                                                                            | Matches                                                                                                             |
| Google button     | 54 high, radius 14, white, 1.5 px `--line-field` border, ink 16/700, Google mark 20 px, 10 gap. Hover: border `--ink`                                                                                           | Matches                                                                                                             |
| Text button       | min 44 high, no padding, indigo 15/700                                                                                                                                                                          | Matches                                                                                                             |
| Text field        | Label 14/600 above, 6 gap; input 50 high, radius 12, 1.5 px `--line-field`, padding 0 14, text 16; hint 13 slate below                                                                                          | Matches                                                                                                             |
| Field error       | 14 px `--error`, with a 16 px circle-alert icon before the text, 6 gap. Input border turns `--error`, `aria-invalid="true"`, and `aria-describedby` points at the error id (plus the hint id when there is one) | **Add** the icon and `aria-describedby`; colour alone is not enough                                                 |
| Notice            | 12/14 padding, radius 12, 20 px icon, 14/1.45 text. Info = indigo tint, Warm = marigold tint, Error = error tint                                                                                                | Matches                                                                                                             |
| Template row (0b) | Link, 14 padding, radius 16, white, 1 px `--line-divider`. 52 px icon tile radius 12 in the category tint with its ink; name 17/700; description 14 slate; 20 px slate chevron                                  | Matches. Tints: Workshop #E6E3FF/#2E2799, Gig #FFE2B8/#7A3E00, School night #FFD9D4/#8C1D12, Meetup #D7F2E6/#0B5A3A |
| Logo lockup       | 26 px stub mark (marigold on ink) + "OneTickets" 19/800 display + "for organisers" 500 mist                                                                                                                     | Matches                                                                                                             |

## 4. Screen 0a: sign-up

Order in the form: Google button, "or use your email" divider (`aria-hidden`), Email, Organiser name with hint "Shown on your event pages. Your own name is fine.", info notice "No ABN or bank details needed now…", flexible spacer, primary button, legal line.

States:

| State                                              | What shows                                                                                                                                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default                                            | Empty fields. Email `autocomplete="email"`, organiser name `autocomplete="organization"`                                                                                                                                                                    |
| Field errors on submit                             | Errors under each bad field (copy in `validation.ts` is approved). Focus moves to the first bad field. No banner                                                                                                                                            |
| **Add** Sending                                    | Button reads "Sending link…" with a 16 px spinner, `aria-busy="true"` on the form, button `disabled`. Keep full indigo (no opacity drop) so the label stays 4.5:1                                                                                           |
| Banner errors (google, link, rate-limited, failed) | Error notice at the top of the form with `role="alert"`. Copy in `bannerText` is approved                                                                                                                                                                   |
| Sent                                               | Mail icon in a 64 px indigo-tint circle, "Check your email" 28/800 (receives focus), body naming the address in bold, "Use a different email" text button (returns focus to the email field, values kept)                                                   |
| **Add** Resend                                     | On the Sent state, below "Use a different email": "Didn't get it? Send it again" text button, disabled with the label "You can resend in 30s" counting down, then enabled. After a resend, a polite status line "Sent again. Check spam if it's not there." |

The canvas's dashed "Prototype: open the link" button is a prototype affordance only. Do not build it.

## 5. Screen 0b: empty organiser home

Ink header: logo row with a **"View site"** link on the right (white 14/600, 44 px tall hit area, goes to `/`). **Add:** the branch's header has no "View site" link yet. Below it the organisation name (15 mist) and "Welcome, {first name}" 28/800.

Body: "No events yet" 22/700 + one line of body copy, the four template rows, "Start from a blank event" (48 high centred text link), then the warm paid-tickets notice. This screen has no pinned primary action; the template rows are the action.

## 6. Behaviour at 375 px and beyond

- Built at 390, must hold at **375** and reflow down to **320** CSS px with no horizontal scroll. At 375: the 0a hero title "Run your first event tonight" wraps to two lines at 32 px; that is expected. Template descriptions wrap under the name; the chevron stays vertically centred.
- Above 512 px the content column centres at `--column` (480) + gutters and the ink header stays full bleed. You already do this.
- Headers are not sticky. At 200% text the ink header scrolls away with the page.
- On 0a, the primary button sits at the end of the form (the spacer pushes it to the bottom on tall screens). It is not pinned; when the on-screen keyboard opens it scrolls with the form, and the field in focus must stay in view (`scroll-margin-bottom: 96px` on inputs).
- Honour `prefers-reduced-motion` (done) and do not animate the spinner when it is set; show "Sending link…" text only.
- Language is `en-AU`. Dates in later screens are "Sat 14 Nov".

## 7. Questions back to design

Send to ProductDesign through the PM thread or directly. Anything not covered here: follow the canvas, then the Design system board's rules.
