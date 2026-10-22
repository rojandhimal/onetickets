import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto';

/**
 * Signs QR ticket payloads (ADR 0011). In AWS the key will live in KMS and only a signing worker's
 * role may use it; locally and in CI a key from the environment stands in. Callers only ever see
 * this interface, so swapping in KMS changes no caller.
 */
export abstract class TicketSigner {
  /** First 8 bytes of SHA-256 of the raw public key, hex. Goes in every token it signs. */
  abstract readonly keyId: string;
  /** The raw 32-byte Ed25519 public key the scanner verifies with. */
  abstract publicKey(): Promise<Uint8Array>;
  abstract sign(payload: Uint8Array): Promise<Uint8Array>;
}

/** An Ed25519 key held in process memory, from a 32-byte seed. For dev and CI only. */
export class LocalEd25519Signer extends TicketSigner {
  readonly keyId: string;
  private readonly privateKey: KeyObject;
  private readonly rawPublicKey: Uint8Array;

  constructor(seed: Uint8Array) {
    super();
    if (seed.length !== 32) throw new Error('An Ed25519 seed is 32 bytes.');
    // PKCS#8 wrapping of a raw Ed25519 seed: a fixed 16-byte prefix, then the seed.
    const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
    this.privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    const spki = createPublicKey(this.privateKey).export({ format: 'der', type: 'spki' });
    this.rawPublicKey = new Uint8Array(spki.subarray(spki.length - 32));
    this.keyId = ticketKeyId(this.rawPublicKey);
  }

  async publicKey(): Promise<Uint8Array> {
    return this.rawPublicKey;
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(sign(null, payload, this.privateKey));
  }
}

/** Key id for a raw Ed25519 public key. */
export function ticketKeyId(rawPublicKey: Uint8Array): string {
  return createHash('sha256').update(rawPublicKey).digest().subarray(0, 8).toString('hex');
}

/**
 * The signer for this process, or null when `TICKET_SIGNING_KEY` is unset: tickets are then
 * issued but stay unsigned until a signer runs. Production never reads a key from the
 * environment; it will use KMS from a signing worker.
 */
export function ticketSignerFromEnv(env: NodeJS.ProcessEnv = process.env): TicketSigner | null {
  const value = env.TICKET_SIGNING_KEY;
  if (!value) return null;
  if (env.NODE_ENV === 'production') {
    throw new Error('TICKET_SIGNING_KEY is for development and CI only. Production signs in KMS.');
  }
  const seed = Buffer.from(value, 'base64');
  if (seed.length !== 32) {
    throw new Error('TICKET_SIGNING_KEY must be 32 bytes, base64 (openssl rand -base64 32).');
  }
  return new LocalEd25519Signer(seed);
}
