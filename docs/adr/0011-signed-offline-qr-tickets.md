# 0011. Signed QR tickets checked offline at the door

- Status: Accepted (key per environment, signing after commit; agreed with Security in #58)
- Date: 2026-10-08, updated 2026-10-22
- Story: S2-3, S3-2, S3-3
- Deciders: Security, BackendDev

## Context

Venues often have poor signal, so checking a ticket at the door cannot depend on a live api call.
A queue at the door is the most visible failure an organiser sees. Tickets also get screenshotted,
forwarded and resold.

## Decision

- Each ticket's QR code is a compact token: version, key id, event id, a random ticket id (UUID
  v4, 122 random bits) and issued-at, then an Ed25519 signature. No name, email or order. The byte
  layout is in `packages/shared/src/api/tickets.ts`; it is base64url, 146 characters.
- The signature covers a fixed context, `onetickets/ticket/v1`, followed by the payload. The
  context is not in the token. A signature the key made over any other kind of message can never
  pass as a ticket.
- **One signing key per environment, not per event.** KMS keys can't be exported, and the signing
  role could call `kms:Sign` on every event key anyway, so per-event keys add little against a
  compromised signer. What they would limit is how many tickets a reissue touches, and that is
  covered by rotation:
  - The key id (the first 8 bytes of the SHA-256 of the raw public key) is in every token, so keys
    rotate by key id. Make a new key at least yearly, and at once on any suspicion.
  - Revoking a key means reissuing every live ticket signed with it. The scanner refuses revoked
    key ids.
- The key is Ed25519 in AWS KMS. KMS supports EdDSA in all regions, Sydney included
  ([AWS, Nov 2025](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-kms-edwards-curve-digital-signature-algorithm/),
  [key spec reference](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html)).
  If that ever changes, the fallback is ECDSA P-256 in KMS.
- **Tickets are issued unsigned in the order's transaction and signed after it commits.** Only the
  signing worker's role may sign; the api cannot. In development and CI a local key stands in
  (`TICKET_SIGNING_KEY`), and the api signs straight after the commit. The local signer refuses to
  exist unless `NODE_ENV` is `development` or `test`, so a key set by mistake in AWS stops the api
  starting. Signing is idempotent: it claims unsigned rows with `for update skip locked`, and a
  trigger stops a signature ever changing once set. While a ticket is unsigned the api returns
  `qr: null`.
- The verifier rejects an unknown version or key id, and checks that the token's event id is the
  event the scanner loaded.
- The scanner downloads the environment's public keys, ticket ids and the revocation list before
  doors open, verifies signatures offline, records scans locally and syncs when it has signal.
- One active check-in per ticket, enforced by a partial unique index. A repeat scan shows amber.

## Consequences

- Scanning works with no signal, in milliseconds.
- A signature proves a ticket is genuine, not unused. A screenshot used at two disconnected gates
  is accepted at MVP and flagged after sync; rotating codes or a local gate hub can close the gap
  later.
- Refunded, released or cancelled tickets must reach the scanner through the revocation list
  (`ticketing.tickets.revoked_at`).
- A leaked environment key means reissuing every live ticket in that environment, not one event's.
- Until the signing worker exists in AWS, tickets there stay unsigned (`qr: null`).
- Lost phones are a privacy risk, so the scanner keeps minimal attendee data and wipes it at event
  end (see the threat model).
