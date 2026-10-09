import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { organiserNameSchema } from '@onetickets/shared';
import { UnitOfWork } from '../../database/database.module.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthService } from './auth.service.js';
import { GoogleOidc } from './google-oidc.js';
import { hashToken, newToken } from './secrets.js';

const STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_RETURN_TO = '/organiser';

/** Only same-site relative paths, so sign-in can never redirect somewhere else. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512) return DEFAULT_RETURN_TO;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_RETURN_TO;
  }
  return value;
}

export type GoogleStart =
  { ok: true; redirect: string; bindingToken: string } | { ok: false; redirect: string };

export type GoogleFinish =
  { ok: true; redirect: string; sessionToken: string } | { ok: false; redirect: string };

/**
 * Google sign-in: authorisation code flow with state, PKCE and nonce, all bound to this browser
 * by a short-lived cookie. Only a verified Google email signs in, and it links to an existing
 * account by that email.
 */
@Injectable()
export class GoogleSignInService {
  private readonly logger = new Logger(GoogleSignInService.name);

  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly uow: UnitOfWork,
    private readonly google: GoogleOidc,
    private readonly auth: AuthService,
  ) {}

  private get redirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI ?? `${this.config.webUrl}/api/auth/google/callback`;
  }

  /** The URL Google redirected to, rebuilt on the public redirect URI (the api sits behind /api). */
  callbackUrl(originalUrl: string): URL {
    const url = new URL(this.redirectUri);
    url.search = new URL(originalUrl, 'http://internal').search;
    return url;
  }

  private failure(error: string): { ok: false; redirect: string } {
    return { ok: false, redirect: `${this.config.webUrl}/signin?error=${error}` };
  }

  async start(organiserName: unknown, returnTo: unknown): Promise<GoogleStart> {
    if (!this.google.configured) return this.failure('google_unavailable');
    const name = organiserNameSchema.safeParse(organiserName);
    const request = {
      redirectUri: this.redirectUri,
      state: randomBytes(32).toString('base64url'),
      nonce: randomBytes(32).toString('base64url'),
      codeVerifier: randomBytes(32).toString('base64url'),
    };
    const bindingToken = newToken();
    await this.uow.run({}, (tx) =>
      tx.query(
        `insert into identity.oauth_states
           (binding_hash, state, code_verifier, nonce, organiser_name, return_to, expires_at)
         values ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7))`,
        [
          hashToken(bindingToken),
          request.state,
          request.codeVerifier,
          request.nonce,
          name.success ? name.data : null,
          safeReturnTo(returnTo),
          STATE_TTL_SECONDS,
        ],
      ),
    );
    const url = await this.google.authorizationUrl(request);
    return { ok: true, redirect: url.toString(), bindingToken };
  }

  async finish(callbackUrl: URL, bindingToken: string | undefined): Promise<GoogleFinish> {
    if (!bindingToken) return this.failure('google');
    const { rows } = await this.uow.run({}, (tx) =>
      tx.query<{
        state: string;
        code_verifier: string;
        nonce: string;
        organiser_name: string | null;
        return_to: string;
      }>(
        `update identity.oauth_states set used_at = now()
          where binding_hash = $1 and used_at is null and expires_at > now()
         returning state, code_verifier, nonce, organiser_name, return_to`,
        [hashToken(bindingToken)],
      ),
    );
    const flow = rows[0];
    if (!flow || callbackUrl.searchParams.get('state') !== flow.state)
      return this.failure('google');

    try {
      const identity = await this.google.exchange(callbackUrl, {
        redirectUri: this.redirectUri,
        state: flow.state,
        nonce: flow.nonce,
        codeVerifier: flow.code_verifier,
      });
      if (!identity.emailVerified) return this.failure('google_unverified');
      const sessionToken = await this.auth.signInVerifiedEmail(
        identity.email,
        flow.organiser_name,
        identity.name,
      );
      return { ok: true, redirect: `${this.config.webUrl}${flow.return_to}`, sessionToken };
    } catch (error) {
      this.logger.warn(`Google sign-in failed: ${(error as Error).message}`);
      return this.failure('google');
    }
  }
}
