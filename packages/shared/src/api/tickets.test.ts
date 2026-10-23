import { describe, expect, it } from 'vitest';
import {
  decodeTicketToken,
  encodeTicketPayload,
  encodeTicketToken,
  TICKET_PAYLOAD_BYTES,
} from './tickets.js';

const claims = {
  keyId: '0123456789abcdef',
  eventId: '6f1c2a5e-8b3d-4f7a-9c10-2d3e4f5a6b7c',
  ticketId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  issuedAt: new Date('2026-12-01T09:30:00Z'),
};
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const signature = Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + 3) & 0xff);

describe('ticket token', () => {
  it('round-trips every claim and the signature', () => {
    const payload = encodeTicketPayload(claims);
    expect(payload).toHaveLength(TICKET_PAYLOAD_BYTES);
    const token = encodeTicketToken(payload, signature);
    expect(token).toMatch(/^[A-Za-z0-9_-]{146}$/);
    const decoded = decodeTicketToken(token);
    expect(decoded).toMatchObject(claims);
    expect(Array.from(decoded!.payload)).toEqual(Array.from(payload));
    expect(Array.from(decoded!.signature)).toEqual(Array.from(signature));
  });

  it('drops milliseconds from issued-at', () => {
    const payload = encodeTicketPayload({
      ...claims,
      issuedAt: new Date('2026-12-01T09:30:00.999Z'),
    });
    const decoded = decodeTicketToken(encodeTicketToken(payload, signature));
    expect(decoded?.issuedAt.toISOString()).toBe('2026-12-01T09:30:00.000Z');
  });

  it('carries nothing but the version, key, event, ticket and time', () => {
    const payload = encodeTicketPayload(claims);
    expect(payload[0]).toBe(1);
    expect(hex(payload.subarray(1, 9))).toBe(claims.keyId);
    expect(hex(payload.subarray(9, 25))).toBe(claims.eventId.replace(/-/g, ''));
    expect(hex(payload.subarray(25, 41))).toBe(claims.ticketId.replace(/-/g, ''));
    expect(new DataView(payload.buffer).getUint32(41)).toBe(claims.issuedAt.getTime() / 1000);
  });

  it('rejects malformed tokens', () => {
    const token = encodeTicketToken(encodeTicketPayload(claims), signature);
    expect(decodeTicketToken('')).toBeNull();
    expect(decodeTicketToken(token.slice(0, -1))).toBeNull();
    expect(decodeTicketToken(`${token}A`)).toBeNull();
    expect(decodeTicketToken(token.replace(/.$/, '+'))).toBeNull();
    // The last character carries 2 spare bits that must be zero: one spelling per token.
    const last = token.at(-1)!;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const sibling = alphabet[alphabet.indexOf(last) ^ 1]!;
    expect(decodeTicketToken(token.slice(0, -1) + sibling)).toBeNull();
    const wrongVersion = encodeTicketPayload(claims);
    wrongVersion[0] = 2;
    expect(decodeTicketToken(encodeTicketToken(wrongVersion, signature))).toBeNull();
  });

  it('refuses claims it cannot encode', () => {
    expect(() => encodeTicketPayload({ ...claims, keyId: 'abc' })).toThrow();
    expect(() => encodeTicketPayload({ ...claims, eventId: 'not-a-uuid' })).toThrow();
    expect(() => encodeTicketPayload({ ...claims, issuedAt: new Date(-1000) })).toThrow();
  });
});
