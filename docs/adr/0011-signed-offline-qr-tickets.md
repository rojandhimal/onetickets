# 0011. Signed QR tickets checked offline at the door

- Status: Proposed (key algorithm and storage to confirm before Sprint 2)
- Date: 2026-10-08
- Story: S2-3, S3-2, S3-3
- Deciders: Security reviewer and architecture; confirm in the S2-3 PR

## Context

Venues often have poor signal, so checking a ticket at the door cannot depend on a live api call.
A queue at the door is the most visible failure an organiser sees. Tickets also get screenshotted,
forwarded and resold.

## Decision

- Each ticket's QR code is a compact token holding a version, key id, event id, a random ticket id
  and issued-at. No name or email.
- Tokens are signed with a per-event key. Preferred: Ed25519 in AWS KMS if KMS in Sydney supports
  it; otherwise ECDSA P-256 in KMS. Only the signing worker may sign; the api cannot. Locally, a
  local signing key stands in.
- The scanner downloads the event's public key, ticket ids and revocation list before doors open,
  verifies signatures offline, records scans locally and syncs when it has signal.
- One active check-in per ticket, enforced by a partial unique index. A repeat scan shows amber.

## Consequences

- Scanning works with no signal, in milliseconds.
- A signature proves a ticket is genuine, not unused. A screenshot used at two disconnected gates
  is accepted at MVP and flagged after sync; rotating codes or a local gate hub can close the gap
  later.
- Refunded or cancelled tickets must reach the scanner through the revocation list.
- Lost phones are a privacy risk, so the scanner keeps minimal attendee data and wipes it at event
  end (see the threat model).
