# 0020. The ticket screen works offline through a service worker scoped to /tickets/

- Status: Proposed
- Date: 2026-10-22
- Story: S2-3
- Deciders: FrontendDev (Claude); Security and ProductDesign to confirm in #56

## Context

An attendee opens their ticket at the door, often with weak or no signal. Design (artboard 4) asks
for the ticket page and its QR to work offline after the first load, with a "Works offline" chip
once they do. The site already runs an enforced, nonce-based CSP on every page (ADR 0018), and the
ticket page holds personal data (the holder's name, the email the tickets went to) behind a key
that only the attendee has.

The page reads its order with a ticket key carried in the URL fragment (`/tickets/{orderId}#key=…`),
so the key never reaches a server log or a `Referer`, the same way sign-in links do (ADR 0001).

## Options considered

- **A service worker for the whole site.** Could make browse and event pages offline too, but
  every page would then pass through it, and a bug there would break the whole site.
- **A service worker scoped to `/tickets/`, fed by the page.** Only ticket pages are controlled.
  The page itself puts its order, its HTML and the built files it loaded into Cache Storage; the
  worker only answers from that cache when the network fails.
- **No service worker; keep the order in localStorage.** The data would survive, but a reload with
  no signal can't load the page itself, so the QR wouldn't show.

## Decision

- `apps/web/public/tickets-sw.js` is registered with scope `/tickets/` by the ticket screen only.
- Ticket pages and `GET /api/public/orders/:id/tickets` are network first, with the saved copy used
  only when the network fails, so a revoked ticket or a changed time shows whenever there's
  signal. Built files under `/_next/static/` are cache first, since their names change with their
  content.
- After a successful read, the page saves the order response, its own HTML and the
  `/_next/static/` files it loaded into the `onetickets-tickets-v1` cache, then shows "Works
  offline". A new cache name drops the old one when the worker activates.
- The page always asks the api first, with no `Authorization` header when it has no key. Only a
  request that fails (no signal, or the api down) shows the saved copy. Any answer from the api
  wins: a refused link (revoked, expired, or no key) shows "That link doesn't work any more.", and
  a refused keyed link also deletes the saved order from Cache Storage.
- The QR is drawn in the browser from the signed token (ADR 0011) as an inline SVG, so there are no
  QR image URLs to cache or leak.
- The page takes the key out of the address bar with `history.replaceState` as soon as it reads
  it, and keeps it in `sessionStorage` for that tab only, so a reload still works. It is never put
  in `localStorage`, Cache Storage or a query string, and the order checkout stashes for the first
  render leaves it out. Ticket pages are `noindex`, send `Referrer-Policy: no-referrer` and keep
  `Cache-Control: private, no-store` from the site-wide proxy.
- The saved HTML keeps the CSP header it was served with. Its nonce matches its own scripts, so a
  page replayed offline still runs under the enforced policy. Registering the worker needs no CSP
  change: `worker-src` falls back to `script-src`, and the e2e CSP guard passes.

## Consequences

- With no signal, an attendee who opened their tickets once can still show the QR, even in a new
  tab that no longer has the key: the saved copy is read from Cache Storage by order id. With
  signal, the same tab without a key sees nothing, so a shared phone reopening the page from
  history doesn't show someone else's tickets. The e2e test
  cuts the page and the worker off from the network and checks this at 375 and 1280 px.
- The holder's name, the order email and the QR tokens stay in Cache Storage on that device. The
  key is never cached. That is the attendee's own device, which Security accepted for MVP (22 Oct),
  but a shared phone keeps them too, so the time they stay is bounded (S2-4a):
  - Each saved order carries an `x-onetickets-expires` header, 7 days after the event ends
    (`SAVED_DAYS_AFTER_END`), worked out from the api's `endsAt` when the order is saved. A
    missing or unreadable date counts as expired. The worker checks it before serving a saved
    order, so a phone that stays offline stops showing it on time. The page drops expired orders
    on every visit and the worker drops them when it starts. Once the last order is dropped, the
    cache goes too.
  - "Remove tickets from this device" on the ticket screen works offline and without the key. It
    deletes that order's saved copy, its page, and the tab's key and stashed order, then takes the
    tickets off the screen. When no other order is saved, it deletes the cache and unregisters the
    worker.
  - A refused keyed link still deletes the saved copy.
  - Signing out or clearing site data also removes them.
- The worker only answers ticket pages, the one order read and built files. It never caches any
  other api path. Its script is same-origin, never kept by a shared cache, and sends no
  `Service-Worker-Allowed`, so its scope can't widen; e2e checks those headers.
- Anyone holding the full link can see the tickets, as with the ticket email. The key's lifetime
  and revocation belong to the tickets api (SEC-4).
- Playwright needs `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` (set in `e2e/playwright.config.ts`)
  so its offline mode and routes reach the worker.
