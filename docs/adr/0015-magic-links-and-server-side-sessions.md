# 0015. Magic links and server-side sessions

- Status: Proposed
- Date: 2026-10-09
- Story: S0-3
- Deciders: BackendDev, with the Security reviewer

## Context

Organisers and their staff sign in a few times a week. Passwords add reset flows, breach risk and
support load. Sessions must be revocable at once when someone leaves an organisation or a device is
lost, and Security asked for single-use, 15-minute links that never appear in logs.

## Decision

- **Email magic links, with Google as an option.** The token is 256 random bits; only its SHA-256
  hash is stored. It works once, for 15 minutes, and a newer link replaces older ones. It travels in
  the URL fragment and is redeemed by POST, so it never reaches access logs or `Referer`
  (the web side of this is ADR 0001).
- **Opaque server-side sessions** in Postgres, not JWTs. The cookie holds a random token; the table
  holds its hash, expiry and the time of the last MFA check. Idle timeout 7 days, absolute 30 days.
- **Cookie and CSRF**: `__Host-` prefixed, HttpOnly, SameSite=Lax; every state-changing request
  must come from `WEB_URL` and be JSON.
- **TOTP for step-up MFA**, with encrypted secrets, replay protection and hashed recovery codes.
- **Rate limits in Postgres**, so they hold across api instances without another service.

## Options considered

- **JWT access tokens**: no database read per request, but they cannot be revoked before expiry
  without a denylist, which brings the database read back.
- **Passwords**: familiar, but the reset flow is itself an email link, with more to get wrong.
- **A hosted identity provider (Cognito, Auth0)**: less code, but per-user cost, a second user
  store to keep in sync with memberships, and less control over the sign-in pages.

## Consequences

- Sign-in depends on email delivery; SES bounce and complaint monitoring matters.
- Each request reads the session row (indexed by token hash). Fine at this scale; a cache can come
  later if needed.
- Signing out, or removing someone, takes effect on their next request.
