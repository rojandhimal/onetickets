import { createHash, randomBytes } from 'node:crypto';

/** A 256-bit random token, URL-safe. Only its hash is ever stored. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

/** Opaque key for rate-limit rows, so emails and IPs are not stored in the clear. */
export function rateKey(kind: string, value: string): string {
  return `${kind}:${createHash('sha256').update(value).digest('base64url')}`;
}
