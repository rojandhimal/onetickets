# Sign-in API

Module: `apps/api/src/modules/identity`. Contracts: `packages/shared/src/api/auth.ts`.

Paths have no `/api` prefix. The web app reaches them through its `/api` rewrite so the session
cookie is first-party. Every error is `ApiErrorBody` (`{ statusCode, code, message, field? }`).

## Rules for every state-changing request

- `Origin` must equal `WEB_URL`, or the api answers 403 `bad_origin`.
- A body must be JSON (`Content-Type: application/json`), or 415 `unsupported_media_type`.
- Validation failures are 422 `invalid_request` with `field`. Too many attempts are 429
  `rate_limited`.

## Magic link

| Method and path                | Body                        | Success                        |
| ------------------------------ | --------------------------- | ------------------------------ |
| `POST /auth/magic-link`        | `{ email, organiserName? }` | 202, no body                   |
| `POST /auth/magic-link/verify` | `{ token }`                 | 200 `Session` + session cookie |

- The answer to `POST /auth/magic-link` is the same whether or not the email exists.
- The email contains `WEB_URL/auth/verify#token=<token>`. The token is in the fragment so it never
  reaches server logs or a `Referer` header; the web page POSTs it to `/verify`.
- A link works once, for 15 minutes, and a newer link for the same email replaces it. Otherwise
  verify answers 410 with `link_expired`, `link_used` or `link_invalid`.
- `organiserName` names the user's first organisation if they have none. The web app does not send
  it: a user with `organisation: null` is sent to `/organiser/setup`.
- Limits: 5 links per email and 30 per IP every 15 minutes, and `MAGIC_LINK_HOURLY_CAP` (300)
  for the whole service in a rolling hour; 30 verify attempts per IP every 15 minutes. The IP is
  the one the load balancer appended (see `TRUST_PROXY_HOPS`), never one the client sent.

## Google

| Method and path                                   | Result                                                    |
| ------------------------------------------------- | --------------------------------------------------------- |
| `GET /auth/google/start?organiserName=&returnTo=` | 302 to Google                                             |
| `GET /auth/google/callback`                       | 302 to `WEB_URL` + `returnTo` with the session cookie set |

- Off unless `GOOGLE_CLIENT_ID` is set. Failures redirect to `/signin?error=` with `google`,
  `google_unverified` (Google has not verified the email) or `google_unavailable` (not configured).
- State, PKCE and nonce are bound to the browser by a short-lived `ot_oauth` cookie.
- `returnTo` must be a relative path; anything else is replaced with `/organiser`.

## Session

| Method and path       | Success                                 |
| --------------------- | --------------------------------------- |
| `GET /me`             | 200 `Session`, or 401 `not_signed_in`   |
| `POST /auth/sign-out` | 204; the session is revoked server-side |

The session cookie is `__Host-ot_session` (`ot_session` on local http): HttpOnly, SameSite=Lax.
It expires after 7 days without use and 30 days after sign-in, whichever is first. Signing in again
on the same browser revokes its previous session.

## MFA (authenticator app)

| Method and path             | Body                             | Success                                        |
| --------------------------- | -------------------------------- | ---------------------------------------------- |
| `POST /me/mfa/totp/setup`   | none                             | 200 `{ secret, otpauthUrl }`                   |
| `POST /me/mfa/totp/confirm` | `{ code }`                       | 200 `{ recoveryCodes }` (10, shown once)       |
| `POST /auth/mfa/verify`     | `{ code }` or `{ recoveryCode }` | 204; the session counts as verified for 15 min |

Errors: 409 `mfa_already_enabled` (setup), 409 `mfa_not_enabled` (verify), 422 `invalid_code`.
Turning MFA on emails the account address, so an enrolment by someone else does not go
unnoticed. Each code works once, and there are 10 attempts per user every 15 minutes. Paying out, granting
owner or finance, and bulk export answer 403 `mfa_required` without a check in the last 15 minutes.
