import { Logger } from '@nestjs/common';

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5_000;

/**
 * Cloudflare's documented test secrets (always pass, always fail, token already spent). Fine in
 * local development and tests; refused in production so a test key can't ship by mistake.
 */
const TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

export type TurnstileOutcome = 'passed' | 'failed' | 'unavailable';

/** Turnstile settings, read once from the environment and validated at startup. */
export function loadTurnstileSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.TURNSTILE_ENABLED !== 'true') return null;
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error('TURNSTILE_ENABLED=true needs TURNSTILE_SECRET_KEY');
  if (env.NODE_ENV === 'production' && TEST_SECRETS.has(secret)) {
    throw new Error(
      "TURNSTILE_SECRET_KEY is one of Cloudflare's test keys, not allowed in production",
    );
  }
  return secret;
}

/**
 * Checks a Turnstile token with Cloudflare (SEC-10). Off unless TURNSTILE_ENABLED=true. Provided
 * by a factory in IdentityModule; tests construct it with a stand-in fetch.
 */
export class Turnstile {
  private readonly logger = new Logger(Turnstile.name);

  constructor(
    private readonly secret: string | null,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get enabled(): boolean {
    return this.secret !== null;
  }

  /**
   * Asks siteverify about the token. Anything short of a clear answer from Cloudflare (network
   * error, timeout, a 5xx, its own internal-error) is 'unavailable', and callers fail closed.
   * The caller's IP isn't sent: it's optional, and Cloudflare saw it when the widget ran.
   */
  async verify(token: string | undefined): Promise<TurnstileOutcome> {
    if (!this.secret) return 'passed';
    if (!token) return 'failed';
    try {
      const res = await this.fetchFn(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: this.secret, response: token }),
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Turnstile siteverify answered ${res.status}; refusing sign-in links`);
        return 'unavailable';
      }
      const body = (await res.json()) as { success?: unknown; 'error-codes'?: unknown };
      if (body.success === true) return 'passed';
      const codes = Array.isArray(body['error-codes']) ? body['error-codes'] : [];
      if (codes.includes('internal-error')) {
        this.logger.warn('Turnstile siteverify had an internal error; refusing sign-in links');
        return 'unavailable';
      }
      return 'failed';
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown error';
      this.logger.warn(`Turnstile siteverify unreachable (${reason}); refusing sign-in links`);
      return 'unavailable';
    }
  }
}
