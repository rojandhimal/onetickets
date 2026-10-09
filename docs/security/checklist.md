# Security checklist (Definition of Done)

Owner: Security reviewer thread. Last updated: 2026-10-09. Background and reasons: [threat-model.md](threat-model.md).

How to use it: every story ticks **Always**. A story that touches an area below also ticks that section. In the PR description, list the sections that apply and mark anything not met as "N/A because..." or "follow-up: card id". The Security reviewer reviews any PR that touches sign-in, roles, payments, QR tickets, the scanner or personal data.

## Always (every PR)

- [ ] No secrets, keys, tokens or real personal data in code, tests, fixtures or commit history
- [ ] All input from the browser, scanner or third parties is validated on the server (types, ranges, lengths); nothing is trusted because the UI hides it
- [ ] New API routes declare who may call them (public, buyer, organisation role); none is reachable by default
- [ ] Database access uses parameterised queries only; no SQL built by string concatenation
- [ ] Errors returned to clients carry no stack traces, SQL or internal ids beyond what the client already has
- [ ] New dependencies are well maintained, needed, and pass `pnpm audit --audit-level=high`
- [ ] Logs and Sentry events from new code contain no personal data or secrets (the shared redactor is used)

## Sign-in and sessions (S0-3, S2-4, S3-1, S7-4)

- [ ] Magic-link and other one-time tokens: at least 128 random bits, stored hashed, single use, short expiry (15 min for sign-in)
- [ ] Tokens are exchanged by POST and removed from the URL; `Referrer-Policy: no-referrer` on the landing page; tokens never logged
- [ ] Same response for known and unknown emails; rate limits on request and redemption
- [ ] Per-IP limits can't be dodged with a spoofed `X-Forwarded-For`: `TRUST_PROXY_HOPS` matches the real proxy chain in every environment (0 locally, 1 behind the ALB, 2 with Cloudflare), and a test sends a spoofed header through the same path and still gets 429
- [ ] Anything that sends email or SMS on an unauthenticated request has a global send cap as well as per-email and per-IP limits
- [ ] Google sign-in uses `state` and PKCE, verifies the ID token and requires `email_verified`
- [ ] Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax` (`__Host-` prefix where possible), rotated on sign-in, revoked on sign-out, with idle and absolute timeouts
- [ ] State-changing requests check `Origin`/`Sec-Fetch-Site` or a CSRF token
- [ ] Redirect targets after sign-in are relative paths only
- [ ] No tokens in `localStorage` or `sessionStorage`

## Roles and tenancy (S0-4, S6-3, S6-6)

- [ ] Organisation id comes from the server-side membership, never from the request body or a client header
- [ ] Every query on tenant data runs under RLS as the non-owner app role, with `SET LOCAL app.organisation_id` inside the transaction
- [ ] A test proves another organisation's rows cannot be read, updated or deleted, run as the real app role
- [ ] Door staff cannot reach money, attendee exports or settings (tested)
- [ ] Step-up MFA before: payout screens, Stripe dashboard links, granting owner or finance, changing account email, refunds over the threshold, bulk CSV export
- [ ] Role changes and other sensitive actions are written to the audit log

## Payments (Sprints 4, 5, 7)

- [ ] Prices and fees computed only on the server by the one pricing function; the client sends ids and quantities
- [ ] Card data only in Stripe's Payment Element or hosted pages (SAQ A)
- [ ] PaymentIntents created server-side with an idempotency key; amount, fee and `on_behalf_of` set by the server
- [ ] Webhooks verify the `Stripe-Signature` on the raw body, reject stale timestamps, are idempotent, and re-fetch the object before acting
- [ ] Paid checkout has bot and card-testing limits (Turnstile, per-IP/email/card rate limits, Radar rules)
- [ ] Refunds go to the original payment method only and post a reversing journal
- [ ] Any money or payout change has a test of its invariant and an audit log entry

## QR tickets and scanner (S2-3, S3-x, S5-3)

- [ ] QR token holds no personal data: version, key id, event id, random ticket id, issued-at
- [ ] Signing key lives in KMS; only the signing worker's role may sign
- [ ] Scanner verifies signature, revocation list and check-in history; server is the source of truth after sync
- [ ] Scanner stores the minimum attendee data, wipes it at event end and on sign-out, and its session is event-scoped and revocable
- [ ] Sync uploads are authenticated and idempotent per scan id

## Personal data and logging (S0-5, S6-4, S10-2)

- [ ] Emails, names, phones, addresses, IPs, auth headers, cookies, tokens and Stripe secrets are masked in logs, Sentry and traces (tested)
- [ ] No request or response bodies sent to Sentry; URL query strings stripped; Session Replay off or fully masked
- [ ] New personal data fields are listed in the privacy notes with a reason and retention period
- [ ] Exports of personal data are permission-checked and audit-logged

## Web front end

- [ ] User-authored content (event descriptions etc.) is sanitised on the server with an allowlist; no raw `dangerouslySetInnerHTML`
- [ ] Security headers set: CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, HSTS
- [ ] Third-party scripts limited to Stripe and agreed analytics, listed in the CSP

## CI and infrastructure (S0-1, S0-2)

- [ ] Workflows use least-privilege `permissions:` and third-party actions pinned by commit SHA
- [ ] Secret scanning and dependency audit run on every PR
- [ ] AWS access from CI is by GitHub OIDC roles, no long-lived keys; production deploy needs approval
- [ ] Secrets come from AWS Secrets Manager at runtime; `.env.example` holds names and local-only values
- [ ] Databases are private, encrypted at rest, TLS in transit
- [ ] Sending domain has SPF, DKIM and DMARC
