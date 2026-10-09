# 0001. Magic-link token travels in the URL fragment and is exchanged by POST

- Status: Accepted
- Date: 2026-10-08
- Story: S0-3

## Context

Organisers sign in with a one-time link sent by email. If the token sits in the query string
(`/auth/verify?token=…`) and a GET to that URL signs the organiser in, then:

- the token is written to server, proxy and CDN access logs;
- it can leak in the `Referer` header to anything the page loads or links to;
- email security scanners that pre-fetch links use it up before the organiser clicks.

## Decision

The link is `/auth/verify#token=…`. Browsers never send the fragment to a server. The page reads the
token in the browser, clears it from the address bar with `history.replaceState`, and exchanges it with
`POST /api/auth/magic-link/verify`. The api sets the session cookie on that response. `/auth/verify`
also sends `Referrer-Policy: no-referrer`.

## Consequences

- Tokens never reach logs or `Referer` headers, and link scanners can't spend them.
- The verify page needs JavaScript. Without it, the organiser sees the page but isn't signed in.
- React Strict Mode runs effects twice in development, so the page guards against sending the token twice.
