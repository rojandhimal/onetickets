# Ticket signing

How QR tickets are signed (S2-3). The token format and key decisions are in
[ADR 0011](../adr/0011-signed-offline-qr-tickets.md); the byte layout and codec are in
`packages/shared/src/api/tickets.ts`.

- `TicketSigner` (`apps/api/src/modules/ticketing/signer.ts`) is the only way to sign.
  `signTicket(payload)` signs the context `onetickets/ticket/v1` followed by the 45-byte payload,
  so the key never signs anything else. The scanner verifies the same bytes:
  `ticketSigningInput(payload)` from `@onetickets/shared`.
- `LocalEd25519Signer` takes a 32-byte seed (`ticketSignerFromEnv` reads `TICKET_SIGNING_KEY`,
  base64). It refuses to exist unless `NODE_ENV` is `development` or `test`, so a seed set by
  mistake in AWS stops the api starting. In AWS a KMS signer in the signing worker takes its
  place behind the same interface.
- The key id is the first 8 bytes of the SHA-256 of the raw public key, and is in every token.
- The redactor scrubs `ticketKey`, `TICKET_SIGNING_KEY` and `#key=` in links.

Issuing and storing tickets builds on the orders schema from S2-2 (#59) and lands once that
merges.
