# 0021. Cloudflare Turnstile checks magic-link requests, behind a flag, failing closed

- Status: Proposed
- Date: 2026-10-24
- Story: SEC-10
- Deciders: PM, FrontendDev (Security to review)

## Context

Anyone can ask `POST /auth/magic-link` to email a sign-in link to any address. Rate limits per
email (5 in 15 minutes), per IP (30 in 15 minutes) and a service-wide hourly cap
(`MAGIC_LINK_HOURLY_CAP`, PR #21) stop a flood from burning our SES reputation, but a bot spread
over many addresses can still use up the cap and lock real organisers out until the hour passes.
The board lists Turnstile on sign-in as a before-launch item. Cloudflare already sits in front of
the site, and Turnstile is free.

## Options considered

- **Turnstile on the sign-in and sign-up pages, checked by the api.** Free, already our CDN, no
  puzzle for most people. Adds a third-party script and frame to two pages.
- **Cloudflare bot rules or a WAF rate rule only.** Nothing in the page, but they can't tell a
  person from a careful bot at low rates, and they're paid features on our plan.
- **hCaptcha or reCAPTCHA.** Same shape as Turnstile, but a new vendor, more friction, and
  reCAPTCHA sends more data to Google.

## Decision

Turnstile, off by default behind runtime settings, so local Docker and the e2e suite behave as
before:

- **api:**
  - `TURNSTILE_ENABLED=true` and `TURNSTILE_SECRET_KEY` turn the check on. It refuses to start
    when the flag is on without a secret, and refuses Cloudflare's test secrets when
    `NODE_ENV=production`.
  - `POST /auth/magic-link` takes an optional `turnstileToken`. With the check on, the order is:
    the per-IP limit, then siteverify, then the per-email limit and the global cap. So a flood
    can't make us call Cloudflare without limit, and failed checks can't use up someone else's
    links.
  - A missing or rejected token is `403 challenge_failed`. If Cloudflare can't answer (network
    error, 5-second timeout, a 5xx, or its `internal-error`), the request fails closed with
    `503 challenge_unavailable`. In both cases no link is sent.
  - The api sends siteverify only the secret and the token, not the client IP: the IP is
    optional, and Cloudflare saw it when the widget ran. The token and secret are never logged.
- **web:**
  - `TURNSTILE_ENABLED=true` and `TURNSTILE_SITE_KEY`, read per request, put the widget on
    `/signin`, `/signup` and the resend button on the "Check your email" screen.
  - The widget uses `execution: 'execute'` and `appearance: 'interaction-only'`. It runs only
    when the person asks for a link, gets a fresh single-use token each time, and shows itself
    only when Cloudflare wants an interaction.
  - If the widget fails, times out, or its script can't load within 15 seconds, the form asks
    the person to try again and doesn't call the api.
- **CSP:** the enforced site CSP adds `https://challenges.cloudflare.com` to `script-src` and
  `frame-src` only on `/signin` and `/signup`, and only with the flag on. The script is inserted
  by our own nonce-trusted code, so `'strict-dynamic'` allows it. The report-only legacy policy
  lists Cloudflare on every path, because it can't vary at run time and doesn't block anything.

## Consequences

- Turn both sides on together. With only the api on, every link request fails; with only the web
  on, the token is ignored.
- Local development and tests use Cloudflare's documented test keys. Docker defaults to the
  always-pass pair when `TURNSTILE_ENABLED=true` is set in `.env`. Real keys come from tegs at
  launch. They are the site key (public) and the secret (into Secrets Manager with the other api
  secrets), and the Terraform wiring for them comes with that change.
- Integration and unit tests stand in for Cloudflare. CI never reaches it, and the e2e suite runs
  with the flag off.
- When Cloudflare is down, nobody can get a sign-in link while the flag is on. Google sign-in
  still works, and existing sessions are unaffected. We accepted this over failing open, which a
  bot could trigger.
- Hostname and action from siteverify aren't checked yet. The site key is limited to our domains
  in Cloudflare's dashboard. Revisit when real keys arrive, or if tokens are found replayed across
  sites.
