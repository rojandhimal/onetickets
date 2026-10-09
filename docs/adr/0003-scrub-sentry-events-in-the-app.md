# 0003. Scrub Sentry events in the app, before they leave

- Status: Accepted
- Date: 2026-10-09
- Story: S0-5

## Context

Errors on sign-up and sign-in pages happen around emails, magic-link tokens and session cookies.
Sentry's server-side data scrubbing runs after the data has already left our infrastructure and is
configured in the Sentry UI, where nobody reviews changes. Organisers' and attendees' personal
information must not end up in a third-party tool we don't need it in (Australian Privacy Principles).

## Decision

The web app removes data before Sentry sends anything:

- `dataCollection` turns off user info, cookies, headers, bodies and query parameters, and
  `sendDefaultPii` is false.
- `beforeSend`, `beforeSendSpan` and `beforeBreadcrumb` keep an allowlist (request method and URL
  without query; user id only) and run every value through `redact()`. It redacts any key whose
  name contains token, secret, password, cookie, authorization, API key, recovery, session or
  email, or has the word otp, totp or mfa, plus exact keys such as name, phone and ip.
- Session replay is not enabled.
- `redact()` and the scrubbers (`scrubEvent`, `scrubBreadcrumb`, `scrubSpan`) live in
  `@onetickets/shared`, so the web app and the api scrub identically.

- CSP violation reports carry the page URL with its query string, the referrer and the blocked URL.
  Browsers post them to our own `/csp-report`, not to Sentry. It keeps only the path of each URL,
  drops `script-sample`, runs the rest through `redact()` and forwards the report from the server,
  so Sentry never sees the reporter's IP address.

Every Sentry project must also have these settings, as a second layer behind the app and for
anything sent before a scrubber existed:

- Security & Privacy: **Data Scrubber** on and **Use Default Scrubbers** on
- Security & Privacy: **Prevent Storing of IP Addresses** on
- Additional Sensitive Fields: `token`, `code`, `state`, `email`

These steps are in the Sentry setup checklist in `docs/web/README.md`.

## Consequences

- Issues show who was affected by id only. Support looks the person up in our own admin.
- Some useful context (query strings, request bodies) is never available in Sentry.
- New fields we want in Sentry have to be added to the allowlist on purpose, with a test.
- A new Sentry project isn't ready until the settings above are on.
- The web app runs one extra endpoint, `/csp-report`. It accepts at most 16 KB, drops anything
  that isn't a CSP report, and always answers 204.
