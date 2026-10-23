import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto';
import { ticketSigningInput } from '@onetickets/shared';

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

  /** Signs a ticket payload under the ticket context, so the key never signs anything else. */
  signTicket(payload: Uint8Array): Promise<Uint8Array> {
    return this.signBytes(ticketSigningInput(payload));
  }

  protected abstract signBytes(input: Uint8Array): Promise<Uint8Array>;
}

/** Where a key from the environment may be used. Anywhere else must sign in KMS. */
const LOCAL_KEY_ENVIRONMENTS = new Set(['development', 'test']);

/**
 * An Ed25519 key held in process memory, from a 32-byte seed. For dev and CI only: it refuses to
 * exist unless NODE_ENV is development or test, so a seed set by mistake in AWS stops the api
 * starting rather than signing tickets with a key outside KMS.
 */
export class LocalEd25519Signer extends TicketSigner {
  readonly keyId: string;
  private readonly privateKey: KeyObject;
  private readonly rawPublicKey: Uint8Array;

  constructor(seed: Uint8Array, nodeEnv = process.env.NODE_ENV) {
    super();
    if (!LOCAL_KEY_ENVIRONMENTS.has(nodeEnv ?? '')) {
      throw new Error('A local ticket signing key is for development and CI only. Sign in KMS.');
    }
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

  protected async signBytes(input: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(sign(null, input, this.privateKey));
  }
}

/** Key id for a raw Ed25519 public key. */
export function ticketKeyId(rawPublicKey: Uint8Array): string {
  return createHash('sha256').update(rawPublicKey).digest().subarray(0, 8).toString('hex');
}

/**
 * The signer for this process, or null when `TICKET_SIGNING_KEY` is unset: tickets are then
 * issued but stay unsigned until a signer runs. Outside development and test a key here stops
 * the api starting; production will sign in KMS from a signing worker. Never log the value.
 */
export function ticketSignerFromEnv(env: NodeJS.ProcessEnv = process.env): TicketSigner | null {
  const value = env.TICKET_SIGNING_KEY;
  if (!value) return null;
  const seed = Buffer.from(value, 'base64');
  if (seed.length !== 32) {
    throw new Error('TICKET_SIGNING_KEY must be 32 bytes, base64 (openssl rand -base64 32).');
  }
  return new LocalEd25519Signer(seed, env.NODE_ENV);
}
