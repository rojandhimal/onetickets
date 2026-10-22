import crypto from 'node:crypto';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generates a human-friendly, high-entropy unique reference code (e.g. `OT-7K8M9P2X`).
 * Uses Crockford's Base32 alphabet to avoid ambiguous characters (I, L, O).
 */
export function newOrderRef(): string {
  const bytes = crypto.randomBytes(8);
  let str = '';
  for (let i = 0; i < 8; i++) {
    str += CROCKFORD_ALPHABET[bytes[i]! % CROCKFORD_ALPHABET.length];
  }
  return `OT-${str}`;
}

/**
 * Generates an attendee ticket reference code (e.g. `T-4D6F8H2K`).
 */
export function newTicketRef(): string {
  const bytes = crypto.randomBytes(8);
  let str = '';
  for (let i = 0; i < 8; i++) {
    str += CROCKFORD_ALPHABET[bytes[i]! % CROCKFORD_ALPHABET.length];
  }
  return `T-${str}`;
}
