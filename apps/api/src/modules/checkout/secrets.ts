import { createHash, randomBytes } from 'node:crypto';

/** A 256-bit URL-safe ticket key (43 characters). Only its SHA-256 hash is stored. */
export function newTicketKey(): string {
  return randomBytes(32).toString('base64url');
}

export const TICKET_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashTicketKey(key: string): Buffer {
  return createHash('sha256').update(key).digest();
}

/**
 * Fingerprint of the holds a checkout presented, so a retry with the same idempotency key must
 * also hold the same hold tokens. Order-independent.
 */
export function holdsDigest(holds: ReadonlyArray<{ id: string; token: string }>): Buffer {
  const hash = createHash('sha256');
  for (const hold of [...holds].sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(hold.id.toLowerCase()).update('\0');
    hash.update(createHash('sha256').update(hold.token).digest());
  }
  return hash.digest();
}
