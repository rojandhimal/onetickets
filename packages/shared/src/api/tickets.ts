// Signed QR tickets (S2-3, ADR 0011). The QR code holds a compact token with no personal data:
// version, key id, event id, a random ticket id and issued-at, followed by an Ed25519 signature.
// The scanner verifies it offline with the public key for the key id.
//
// Layout (109 bytes, base64url without padding, 146 characters):
//   0       version (1)
//   1..8    key id (first 8 bytes of SHA-256 of the raw 32-byte public key)
//   9..24   event id (UUID, 16 bytes)
//   25..40  ticket id (random UUID v4, 16 bytes)
//   41..44  issued-at (seconds since the Unix epoch, unsigned 32-bit big-endian)
//   45..108 Ed25519 signature over TICKET_SIGNING_CONTEXT followed by bytes 0..44
//
// The context is signed but not sent, so a signature the key made over any other kind of message
// can never pass as a ticket.

export const TICKET_TOKEN_VERSION = 1;
export const TICKET_KEY_ID_BYTES = 8;
export const TICKET_PAYLOAD_BYTES = 45;
export const TICKET_SIGNATURE_BYTES = 64;
export const TICKET_TOKEN_BYTES = TICKET_PAYLOAD_BYTES + TICKET_SIGNATURE_BYTES;
export const TICKET_SIGNING_CONTEXT = 'onetickets/ticket/v1';

/** The exact bytes signed and verified for a ticket payload: the context, then the payload. */
export function ticketSigningInput(payload: Uint8Array): Uint8Array {
  const context = Uint8Array.from(TICKET_SIGNING_CONTEXT, (c) => c.charCodeAt(0));
  const input = new Uint8Array(context.length + payload.length);
  input.set(context);
  input.set(payload, context.length);
  return input;
}

export interface TicketTokenClaims {
  /** Hex, 16 characters. */
  keyId: string;
  eventId: string;
  ticketId: string;
  /** Whole seconds; the token can't carry milliseconds. */
  issuedAt: Date;
}

export interface DecodedTicketToken extends TicketTokenClaims {
  /** The signed bytes, for the verifier. */
  payload: Uint8Array;
  signature: Uint8Array;
}

/** The bytes a signer signs. */
export function encodeTicketPayload(claims: TicketTokenClaims): Uint8Array {
  const keyId = hexToBytes(claims.keyId);
  if (keyId.length !== TICKET_KEY_ID_BYTES) throw new Error('Key id must be 8 bytes.');
  const seconds = Math.floor(claims.issuedAt.getTime() / 1000);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 0xffffffff) {
    throw new Error('Issued-at is out of range.');
  }
  const out = new Uint8Array(TICKET_PAYLOAD_BYTES);
  out[0] = TICKET_TOKEN_VERSION;
  out.set(keyId, 1);
  out.set(uuidToBytes(claims.eventId), 9);
  out.set(uuidToBytes(claims.ticketId), 25);
  new DataView(out.buffer).setUint32(41, seconds);
  return out;
}

/** The QR token: payload and signature, base64url. */
export function encodeTicketToken(payload: Uint8Array, signature: Uint8Array): string {
  if (payload.length !== TICKET_PAYLOAD_BYTES) throw new Error('Payload must be 45 bytes.');
  if (signature.length !== TICKET_SIGNATURE_BYTES) throw new Error('Signature must be 64 bytes.');
  const out = new Uint8Array(TICKET_TOKEN_BYTES);
  out.set(payload, 0);
  out.set(signature, TICKET_PAYLOAD_BYTES);
  return bytesToBase64Url(out);
}

/** Parses a token without checking its signature. Returns null for anything malformed. */
export function decodeTicketToken(token: string): DecodedTicketToken | null {
  const bytes = base64UrlToBytes(token);
  if (!bytes || bytes.length !== TICKET_TOKEN_BYTES || bytes[0] !== TICKET_TOKEN_VERSION) {
    return null;
  }
  const payload = bytes.slice(0, TICKET_PAYLOAD_BYTES);
  return {
    keyId: bytesToHex(payload.subarray(1, 9)),
    eventId: bytesToUuid(payload.subarray(9, 25)),
    ticketId: bytesToUuid(payload.subarray(25, 41)),
    issuedAt: new Date(new DataView(payload.buffer).getUint32(41) * 1000),
    payload,
    signature: bytes.slice(TICKET_PAYLOAD_BYTES),
  };
}

export type TicketStatus = 'valid' | 'revoked';

/** One ticket as the buyer sees it on the confirmation screen. */
export interface TicketDto {
  id: string;
  /** Short code printed on the stub (8 Crockford base32 characters), for door staff to type. */
  ref: string;
  /** The one name given at checkout; every ticket in the order shows it. */
  holderName: string;
  ticketTypeId: string;
  ticketTypeName: string;
  /**
   * The signed token to draw as a QR code. Null for the moment between issuing and signing, and
   * for a revoked ticket.
   */
  qr: string | null;
  status: TicketStatus;
  issuedAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidToBytes(uuid: string): Uint8Array {
  if (!UUID_RE.test(uuid)) throw new Error('Not a UUID.');
  return hexToBytes(uuid.replace(/-/g, ''));
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error('Not hex.');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let j = 0; j < chars; j++) out += ALPHABET[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

function base64UrlToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 6) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const char of text) {
    value = ((value << 6) | ALPHABET.indexOf(char)) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (value >> bits) & 0xff;
    }
  }
  // Leftover bits must be zero, so every token has exactly one spelling.
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) return null;
  return out;
}
