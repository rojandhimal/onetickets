/** Sign-in settings, read once from the environment and validated at startup. */
export interface AuthConfig {
  /** Origin of the web app, e.g. https://onetickets.com.au. Links and redirects go here. */
  webUrl: string;
  /** Secure cookies (with the __Host- prefix). Only local http development turns this off. */
  secureCookies: boolean;
  /** 32-byte key that encrypts MFA secrets at rest. */
  mfaKey: Buffer;
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export const MAGIC_LINK_TTL_MS = 15 * 60_000;
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60_000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60_000;
/** How long a passed MFA check counts for step-up actions such as payouts. */
export const MFA_STEP_UP_MS = 15 * 60_000;

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const raw = env.WEB_URL;
  if (!raw) throw new Error('WEB_URL is not set');
  const webUrl = new URL(raw).origin;
  const secureCookies = env.SESSION_COOKIE_SECURE !== 'false';
  if (!secureCookies && env.NODE_ENV === 'production') {
    throw new Error('SESSION_COOKIE_SECURE=false is not allowed in production');
  }
  const mfaKey = Buffer.from(env.MFA_ENCRYPTION_KEY ?? '', 'base64');
  if (mfaKey.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes, base64 (openssl rand -base64 32)');
  }
  return { webUrl, secureCookies, mfaKey };
}

export function sessionCookieName(config: AuthConfig): string {
  return config.secureCookies ? '__Host-ot_session' : 'ot_session';
}
