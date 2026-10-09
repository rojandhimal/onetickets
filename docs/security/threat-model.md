# OneTickets threat model

Owner: Security reviewer thread. Last updated: 2026-10-08.
Sources: [System architecture](https://claude.ai/code/artifact/0cb5d06a-c2b1-4479-9497-d7774176acfb), [Architecture review](https://claude.ai/code/artifact/01a2857b-b93c-4784-bffa-af9f6962663f), [MVP sprint backlog](https://claude.ai/code/artifact/908caae3-7868-4e89-9a10-4da3f5d376ae), repo scaffold at commit c7da9aa.
Scope: the MVP (Sprints 0 to 10). Method: STRIDE per area, ranked by impact x likelihood for a small Australian ticketing platform. This is a living document: it is updated when a design or story changes.

## What we are protecting

| Asset                                                  | Why it matters                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Money flows (Stripe Connect charges, refunds, payouts) | Direct financial loss to organisers, buyers or OneTickets                  |
| Ticket validity (signed QR, check-in state)            | Fake or duplicated tickets get people into venues; real buyers turned away |
| Inventory (sold + held <= capacity)                    | Oversell breaks trust and Consumer Law                                     |
| Organiser accounts and roles                           | Takeover lets an attacker redirect payouts, refund, or read attendee data  |
| Attendee personal data (names, emails, orders)         | Privacy Act 1988 and the Notifiable Data Breaches scheme apply             |
| Signing keys, Stripe keys, AWS credentials             | Compromise of any one breaks a whole control above                         |

## Actors

- **Anonymous internet user / bot**: card testers, scalper bots, credential stuffers, scrapers.
- **Buyer (attendee)**: no account, has an order email and magic link. May try to forge, copy or reuse tickets.
- **Organiser members**: owner, admin, finance, door staff. One organisation must never see another's data; door staff must never see money.
- **Malicious organiser**: creates a scam event, takes money, disappears; or uses OneTickets to phish.
- **OneTickets staff (admin console)**: powerful by design; must be authenticated strongly and audited.
- **Supply chain**: npm dependencies, GitHub Actions, third-party scripts on the web app.

## Trust boundaries

1. Browser to Cloudflare edge to API (ECS Fargate). Everything from the browser is untrusted.
2. API to Postgres. RLS is the second wall behind application checks, not the only one.
3. API and workers to Stripe, SES, KMS. Inbound Stripe webhooks are untrusted until the signature is verified.
4. Scanner device (offline) to API. The device is in a stranger's hands at a door and can be lost.
5. CI (GitHub Actions) to AWS. CI is a path to production.

## Top risks and the sprint each belongs to

Likelihood and impact are H/M/L. "Story" is where the control should land as acceptance criteria. Items marked **NEW** are not in the backlog today and are proposed to PM.

| #   | Risk                                                                                                                        | L   | I   | Control                                                                                                                                                                    | Sprint / story                        |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| T1  | Organiser account takeover (phished magic link, stolen session, Google account linking) then payout redirect or mass refund | M   | H   | Single-use, short-lived magic links; HttpOnly session cookies; step-up MFA on money and role actions; 48 h payout hold on email change                                     | S0-3, S0-4, S7-1                      |
| T2  | Cross-organisation data leak through a missing `organisation_id` filter (IDOR)                                              | M   | H   | Deny-by-default guards plus RLS that actually bites (non-owner role, `FORCE`, `SET LOCAL`), cross-tenant test as the app role                                              | S0-4                                  |
| T3  | Card testing: bots use cheap paid tickets to validate stolen cards, causing disputes and Stripe account risk                | H   | H   | Turnstile and rate limits on PaymentIntent creation, Radar rules, per-IP/per-email order limits **from Sprint 4**, not Sprint 9                                            | S4-3 **NEW** (backlog has it in S9-2) |
| T4  | Forged Stripe webhook marks an order paid                                                                                   | M   | H   | Verify `Stripe-Signature` on the raw body, reject old timestamps, re-fetch the PaymentIntent before fulfilling                                                             | S4-4 **NEW** (make explicit)          |
| T5  | Copied QR (screenshot shared or resold) admits several people                                                               | H   | M   | Signed token proves authenticity only; one active check-in per ticket (partial unique index); amber on repeat; offline duplicates flagged after sync; rotating codes later | S2-3, S3-2, S3-3                      |
| T6  | Forged QR token                                                                                                             | L   | H   | Ed25519 (or P-256) signature, per-event key in KMS, key id in token, scanner holds public key only, revocation list                                                        | S2-3, S3-3                            |
| T7  | Lost or stolen door-staff phone leaks attendee list                                                                         | M   | M   | Download names only for manual search, minimal fields, wipe at event end and on session revoke, short-lived event-scoped scanner session                                   | S3-1, S3-3, S3-4                      |
| T8  | Stored XSS in organiser-authored event content runs on public event pages and steals buyer sessions                         | M   | H   | Sanitise rich text server-side with an allowlist, strict CSP, no `dangerouslySetInnerHTML` of raw input, image URLs via our own upload                                     | S1-1, S1-3 **NEW**                    |
| T9  | Scam or fraudulent events (sell tickets to nothing, then cash out)                                                          | M   | H   | Post-event payouts, first-event review over A$10,000, dispute freeze, prohibited-events policy, takedown in admin console                                                  | S5-5, S7-1, S7-4, S10-2               |
| T10 | Secrets or tokens leaked in logs, Sentry, URLs or the repo                                                                  | M   | H   | PII and secret scrubbing in logs and Sentry, magic-link tokens never logged, `Referrer-Policy`, secret scanning in CI                                                      | S0-1, S0-5                            |
| T11 | CI or dependency compromise reaches production                                                                              | L   | H   | GitHub OIDC to AWS (no long-lived keys), actions pinned by SHA, lockfile enforced, dependency audit, prod deploy needs approval                                            | S0-1, S0-2                            |
| T12 | Email spoofing of OneTickets (phishing organisers and buyers)                                                               | M   | M   | SPF, DKIM and DMARC (`p=quarantine` then `reject`) on the sending domain                                                                                                   | S0-2 **NEW**                          |
| T13 | Oversell or hold abuse (bots hold all stock, then release)                                                                  | M   | M   | Conditional `UPDATE`, per-order limits, no hold renewal while waiting room is on, Turnstile on queue entry                                                                 | S2-1, S9-1, S9-2                      |
| T14 | Admin console abuse or takeover                                                                                             | L   | H   | SSO and MFA, least-privilege staff roles, append-only audit log, no silent impersonation                                                                                   | S7-4                                  |
| T15 | Buyer order and ticket enumeration (guess order or ticket ids, read others' tickets)                                        | M   | M   | Random (UUID v4 / ULID with randomness) ids, buyer access only via signed magic link or session bound to the order email, buyer RLS role                                   | S2-2, S2-4                            |
| T16 | Refund abuse: refund after check-in, or refunds sent somewhere other than the original card                                 | L   | M   | Refunds only to original payment method (Stripe default), step-up MFA above a threshold, audit log, refunded tickets revoked                                               | S5-3                                  |

## Area detail

### 1. Authentication (S0-3, S2-4, S3-1, S7-4)

**Threats:** magic-link interception or reuse, token leakage in logs and Referer headers, account enumeration, credential-less brute force on the email OTP/link endpoint, Google account linking to the wrong account, session theft via XSS, CSRF on cookie-authenticated endpoints.

**Requirements (Sprint 0 review checklist for S0-3):**

- Magic-link token: at least 128 bits from a CSPRNG, stored only as a hash, single use, expires in 15 minutes or less, invalidated when a newer link is issued.
- The link lands on a page that exchanges the token by `POST`, then redirects to a clean URL. The token never appears in server logs, Sentry, OTel spans or analytics; `Referrer-Policy: no-referrer` on that page.
- Same response and timing for known and unknown emails ("If that email is registered, we've sent a link").
- Rate limits on link requests per email and per IP (Cloudflare rule plus an app-level counter), and on token redemption.
- Google sign-in: authorisation code flow with `state` and PKCE, verify the ID token (`iss`, `aud`, `exp`, signature), require `email_verified = true`, link to an existing account by verified email only.
- Session: opaque server-side session id (or short-lived token plus rotation) in a cookie with `HttpOnly; Secure; SameSite=Lax`, `__Host-` prefix where the domain allows; rotate on sign-in; idle and absolute timeouts; sign-out revokes server-side.
- CSRF: `SameSite=Lax` plus an `Origin`/`Sec-Fetch-Site` check (or a CSRF token) on every state-changing request.
- No open redirect: the post-sign-in `next` parameter accepts relative paths only.
- Security headers on web: CSP (start in report-only), `X-Content-Type-Options`, `frame-ancestors 'none'`, HSTS.

**Buyer "My tickets" magic link (S2-4):** this link sits in an email that people forward. Make it open a read-only ticket view scoped to that order, expire it (for example 30 days, re-requestable by email), and never let it change the order email or refund.

**Door staff (S3-1):** scanner session is scoped to one organisation's events, short-lived (ends after the event day), and revocable remotely.

### 2. Authorisation and multi-tenancy (S0-4, S6-3, S6-6)

**Threats:** IDOR across organisations, privilege escalation by a member granting themselves owner or finance, door staff reaching money, RLS bypassed by the owning role or a pooled connection carrying the previous tenant.

**Requirements (Sprint 0 review checklist for S0-4):**

- Deny by default: every controller route declares the roles allowed; a route with no declaration fails a test.
- The organisation id comes from the server-side session membership, never from a request body or header the client controls. A path parameter organisation id is checked against membership.
- RLS per architecture review fix 11: app connects as a non-owner role (or tables use `FORCE ROW LEVEL SECURITY`); tenant set with `SET LOCAL app.organisation_id` inside each transaction; separate roles and policies for buyer paths and workers, no bypass flag.
- The cross-tenant test runs as the real app role and covers read, update and delete, plus a pooled-connection test that a second request does not see the first tenant.
- Role changes: only owners grant owner or finance; the last owner cannot be removed; every role change is audit-logged and emails the owners.
- Step-up MFA (TOTP or passkey) for owner and finance, required before: payout screens and Stripe Express dashboard links, granting owner/finance, changing the account email, refunds above a threshold, and bulk attendee CSV export. The backlog only names payout screens; the rest are **NEW**.
- MFA recovery codes are hashed; MFA reset by support needs identity verification and holds payouts 48 h.

### 3. Payments (Sprints 4, 5, 7)

**Threats:** card testing, forged or replayed webhooks, price tampering, double fulfilment, refund abuse, payout redirection, dispute losses, platform seen as merchant of record (architecture review fix 1).

**Requirements:**

- Card data never touches our servers: Stripe Payment Element only (SAQ A). CSP restricts scripts to our origin and Stripe.
- Price is computed server-side by the one pricing function; the client sends ticket type ids and quantities only.
- PaymentIntent created server-side with an idempotency key; amount, currency, `application_fee_amount`, `on_behalf_of` and `transfer_data` set by the server.
- Webhooks: verify signature on the raw body with the endpoint secret, 5-minute tolerance, idempotent on event id and PaymentIntent id, re-fetch the object from Stripe before acting. The webhook route is exempt from CSRF and auth but not from signature checks.
- Card-testing defences from Sprint 4: Turnstile on checkout for paid orders, rate limits per IP, per email and per card fingerprint, Radar rules for many low-value attempts, alert on decline-rate spikes. **Proposed move from S9-2 into S4-3.**
- Restrict payment methods to cards and wallets (architecture review fix 7).
- Refunds go only to the original payment method; partial refunds can't exceed captured amount; each posts a reversing journal.
- Payout safety: post-event release, dispute freeze, 48 h hold on email or bank change, daily reconciliation blocks payouts on mismatch (already in S5-5, S7-1, S7-3).
- Stripe secret key lives in Secrets Manager, restricted keys where possible, separate keys per environment; live keys never in staging.

### 4. QR tickets (S2-3, S5-3)

**Threats:** forged tickets, copied tickets, key theft, PII in the code, revoked tickets still scanning.

**Requirements:**

- Token payload: version, key id, event id, ticket id (random), issued-at. No name or email. Compact encoding (CBOR or base45) to keep the QR small.
- Signature: Ed25519 with a per-event key in KMS if KMS supports it in ap-southeast-2; otherwise ECDSA P-256 in KMS (preferred over holding Ed25519 private keys in Secrets Manager, since KMS never exports the key). Confirm before Sprint 2.
- Only the signing worker's IAM role may call `kms:Sign` on ticket keys; the API cannot.
- Key rotation: key id in the token lets a new key be added without invalidating issued tickets; a compromised event key can be revoked and all its tickets reissued.
- Revocation list (refunds, cancellations, reissues) downloaded by the scanner and checked offline.
- The signature proves a ticket is genuine, not that it is unused. Duplicate protection is the check-in record (T5).
- The QR image and PDF are not cached publicly; email links to tickets follow the buyer magic-link rules above.

### 5. Door scanner (S3-1 to S3-5)

**Threats:** offline duplicate admission across gates, lost device with attendee data, malicious door staff, tampered local check-in history, replayed sync uploads.

**Requirements:**

- The scanner downloads the public key, ticket ids and revocation list; names only on request for manual search, limited to first name and last initial plus a hashed email for exact-match lookup where possible (architecture review note).
- Local data wiped at event end, on sign-out, and on remote session revocation at next contact.
- Sync uploads are authenticated with the scanner session, idempotent per scan id, and the server, not the device, is the source of truth for "already admitted".
- Device clock is not trusted for anything security-relevant; the server records receive time too.
- Name-search check-ins are logged with the staff member, so abuse by door staff is traceable.

### 6. Personal data and logging (S0-5, S6-4, S10-2)

**Requirements (Sprint 0 review checklist for S0-5):**

- A single redaction layer used by the logger, Sentry `beforeSend`/`beforeBreadcrumb`, and OTel attribute processing: emails, names, phone numbers, addresses, IPs (truncate), `Authorization`, `Cookie`, `Set-Cookie`, magic-link and OAuth tokens, Stripe keys and client secrets.
- Request and response bodies are not sent to Sentry by default; URLs have query strings stripped or tokens redacted.
- Sentry Session Replay off, or with all text and inputs masked.
- Organisation, request and order ids are fine to log; they are not personal data on their own.
- A unit test feeds a known PII sample through the redactor for each sink.
- Log retention set (for example 30 days app logs, 1 year audit log) and documented for the privacy policy.

## Cross-cutting engineering controls (S0-1, S0-2)

- CI: secret scanning (gitleaks or GitHub secret scanning with push protection), `pnpm audit --audit-level=high` or Dependabot alerts gating merges, `pnpm install --frozen-lockfile`, third-party actions pinned by commit SHA, `permissions:` set to least privilege in every workflow.
- AWS: GitHub OIDC role per environment, no IAM user keys; production deploy role usable only from `main` with the environment approval.
- Secrets in AWS Secrets Manager, injected at runtime; `.env.example` holds names only.
- Databases encrypted at rest, TLS required in transit (`sslmode=verify-full`), not publicly reachable.
- Email domain: SPF, DKIM (SES), DMARC.
- Branch protection on `main`: required reviews and CI.

## Decisions made in review (Sprint 0)

| Date       | Decision                                                                                                                                                        | Where    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-10-09 | CI runs gitleaks and `pnpm audit --prod --audit-level=high` on every PR and weekly; Dependabot updates actions and npm weekly; actions pinned by SHA            | #3       |
| 2026-10-09 | Deploy workflows run only from `main` (manual dispatch on `main`, or a `push` CI run in this repository), never from a fork PR's `workflow_run`                 | #4       |
| 2026-10-09 | The api trusts exactly one proxy hop for the client IP (`TRUST_PROXY_HOPS=1`), because the Next rewrite forwards `X-Forwarded-For` unchanged                    | #4       |
| 2026-10-09 | Staging tasks may run in public subnets without NAT, inbound only from the load balancer; production keeps private subnets and one NAT per AZ                   | #4       |
| 2026-10-09 | App database roles have no `delete` grants until a feature needs one; audit events are insert-only and block deleting their organisation (`on delete restrict`) | #6       |
| 2026-10-09 | Step-up MFA is a server-side timestamp valid for 15 minutes; every sign-in starts a new unverified session                                                      | #6, S0-3 |
| 2026-10-09 | Web responses carry security headers (CSP, HSTS, frame-ancestors none, nosniff, referrer policy) from one shared module                                         | #2       |

Follow-ups agreed: pending invites the invitee must accept before membership exists (from #6); ALB ingress limited to Cloudflare ranges and database TLS `verify-full` before Sprint 4 (from #4).

## Out of scope for the MVP, noted for later

- Rotating QR codes or a local gate hub to close the offline duplicate gap (architecture review "revisit").
- Native scanner app with hardware-backed storage.
- Bug bounty after launch.
- SOC 2 or ISO 27001: not needed for launch; revisit with enterprise organisers.

## Open questions

1. Does AWS KMS in ap-southeast-2 support Ed25519 signing today? Decides T6 key handling. Needed by Sprint 2.
2. Is Stripe Radar for Fraud Teams wanted, or the default rules only? Decides card-testing tooling in Sprint 4.
3. Who receives security alerts and breach notifications (on-call rota, privacy officer under the Privacy Act)? Needed by Sprint 10.
