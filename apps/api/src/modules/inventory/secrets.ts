import { createHash, randomBytes } from 'node:crypto';

/** A 256-bit URL-safe random token. Only its SHA-256 hash is stored in the database. */
export function newHoldToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashHoldToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
