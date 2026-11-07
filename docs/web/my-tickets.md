# Attendee portal: My tickets (S2-4)

The attendee portal allows ticket buyers to access their booked tickets via a passwordless,
read-only magic link sent to their email.

## Routes & Screens

- **`/my-tickets`**:
  - **Signed-out view**: "Find your tickets" lookup form. An attendee enters their email to request a secure link. Submitting displays a constant confirmation message without revealing whether tickets exist (`Check your email. If {email} has tickets, the link is on its way.`), preventing account enumeration.
  - **Signed-in view**: "My tickets" portal displaying two tabs:
    - **Upcoming**: Shows active/future bookings ordered by start date (earliest first). Each card displays the event eyebrow date/time, event name, venue/online details, ticket count, and a primary **Show QR** action linking to `/tickets/:orderId`. When empty, renders "No upcoming tickets." with a link to Browse ("Find something on this weekend").
    - **Past**: Shows historical bookings ordered by start date (most recent first). When empty, renders "No past tickets."
    - **Sign out**: Revokes the attendee session cookie via `POST /api/attendee/sign-out` and returns to the lookup view.
- **`/my-tickets/verify`**:
  - Secure fragment landing page (`#token=<token>`).
  - Reads the 256-bit token from the URL hash fragment.
  - **Immediately strips** the hash fragment using `window.history.replaceState` before or upon exchange to ensure the bearer token is never leaked in HTTP Referer headers or client history.
  - Exchanges the token with `POST /api/attendee/magic-link/verify` to establish an HTTP-only, SameSite=Lax session cookie.
  - Redirects to `/my-tickets` upon successful exchange.
  - On expired token (HTTP 410) or invalid link, renders an informative error message with a link to request a new link.

## Security & Privacy (SEC-4)

1. **Strict Session Boundary**: The attendee session is email-scoped with read-only permissions (`tickets:read`) and can never access organiser identity or organisation APIs.
2. **Hash Fragment Transport**: Magic link tokens are delivered in the URL fragment (`#token=...`), which is never sent over the wire to server logs or CDNs.
3. **No Storage Leakage**: Attendee credentials and tokens are never persisted in `localStorage` or `sessionStorage`.
4. **Site-Wide CSP & Nonces**: Protected by the site-wide nonce-enforced Content Security Policy (ADR 0018).
5. **Runtime Feature Flag**: Both the server pages and backend endpoints sit behind the `FEATURE_ATTENDEE_TICKETS=true` runtime flag, returning 404 when disabled.

## Testing & Verification

- **Unit tests**:
  - `apps/web/src/lib/attendee.test.ts`: Request link, verify link, fetch session, sign out, pagination, and order partitioning.
  - `apps/web/src/lib/flags.test.ts`: Runtime feature flag check.
- **Component tests**:
  - `apps/web/src/app/my-tickets/MyTicketsClient.test.tsx`: Lookup form, rate limiting, no-enumeration notice, upcoming/past order cards, empty states, and sign out.
  - `apps/web/src/app/my-tickets/verify/VerifyAttendeeClient.test.tsx`: Hash fragment token extraction, immediate history clearing, verification redirect, and expired error states.
  - `apps/web/src/app/my-tickets/page.test.tsx`: Server page feature flag gating.
