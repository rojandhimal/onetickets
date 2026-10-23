import { createPublicKey, generateKeyPairSync, randomBytes, verify } from 'node:crypto';
import {
  decodeTicketToken,
  encodeTicketPayload,
  encodeTicketToken,
  ticketSigningInput,
} from '@onetickets/shared';
import { describe, expect, it } from 'vitest';
import { LocalEd25519Signer, ticketKeyId, ticketSignerFromEnv } from './signer.js';

/** The verifier the scanner will run: raw public key, payload under the context, signature. */
function verifies(rawPublicKey: Uint8Array, payload: Uint8Array, signature: Uint8Array): boolean {
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPublicKey]);
  const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
  return verify(null, ticketSigningInput(payload), key, signature);
}

const claims = (keyId: string) => ({
  keyId,
  eventId: '6f1c2a5e-8b3d-4f7a-9c10-2d3e4f5a6b7c',
  ticketId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  issuedAt: new Date('2026-12-01T09:30:00Z'),
});

describe('LocalEd25519Signer', () => {
  it('signs a token the public key verifies, and nothing else', async () => {
    const signer = new LocalEd25519Signer(randomBytes(32));
    const publicKey = await signer.publicKey();
    const payload = encodeTicketPayload(claims(signer.keyId));
    const token = encodeTicketToken(payload, await signer.signTicket(payload));

    const decoded = decodeTicketToken(token)!;
    expect(decoded.keyId).toBe(signer.keyId);
    expect(verifies(publicKey, decoded.payload, decoded.signature)).toBe(true);

    const tampered = Buffer.from(decoded.payload);
    tampered.writeUInt8(tampered.readUInt8(30) ^ 1, 30); // another ticket id
    expect(verifies(publicKey, tampered, decoded.signature)).toBe(false);

    const other = new LocalEd25519Signer(randomBytes(32));
    expect(verifies(await other.publicKey(), decoded.payload, decoded.signature)).toBe(false);

    // Signed under the context: the bare payload's signature check fails.
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), publicKey]),
      format: 'der',
      type: 'spki',
    });
    expect(verify(null, decoded.payload, key, decoded.signature)).toBe(false);
  });

  it('refuses to exist outside development and test', () => {
    expect(() => new LocalEd25519Signer(randomBytes(32), 'production')).toThrow(/KMS/);
    expect(() => new LocalEd25519Signer(randomBytes(32), '')).toThrow(/KMS/);
    expect(new LocalEd25519Signer(randomBytes(32), 'development').keyId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('derives the same public key and key id as Node does from the seed', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
    const signer = new LocalEd25519Signer(seed);
    expect(Buffer.from(await signer.publicKey())).toEqual(raw);
    expect(signer.keyId).toBe(ticketKeyId(raw));
    expect(signer.keyId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('refuses a seed that is not 32 bytes', () => {
    expect(() => new LocalEd25519Signer(randomBytes(31))).toThrow();
  });
});

describe('ticketSignerFromEnv', () => {
  const key = randomBytes(32).toString('base64');

  it('is off when no key is set', () => {
    expect(ticketSignerFromEnv({})).toBeNull();
  });

  it('reads a 32-byte base64 seed', () => {
    expect(ticketSignerFromEnv({ TICKET_SIGNING_KEY: key, NODE_ENV: 'test' })).toBeInstanceOf(
      LocalEd25519Signer,
    );
  });

  it('refuses a short key', () => {
    expect(() => ticketSignerFromEnv({ TICKET_SIGNING_KEY: 'c2hvcnQ=', NODE_ENV: 'test' })).toThrow(
      /32 bytes/,
    );
  });

  it('never takes a key from the environment in production', () => {
    expect(() => ticketSignerFromEnv({ TICKET_SIGNING_KEY: key, NODE_ENV: 'production' })).toThrow(
      /KMS/,
    );
  });
});

describe('ticket token encoding', () => {
  it('matches Node base64url byte for byte', () => {
    const payload = encodeTicketPayload(claims('0123456789abcdef'));
    const signature = randomBytes(64);
    expect(encodeTicketToken(payload, signature)).toBe(
      Buffer.concat([payload, signature]).toString('base64url'),
    );
  });
});
