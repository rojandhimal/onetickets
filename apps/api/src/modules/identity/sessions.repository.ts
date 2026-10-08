import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, MFA_STEP_UP_MS } from './auth.config.js';
import type { AuthContext } from './auth-context.js';
import { hashToken, newToken } from './secrets.js';

/** Server-side sessions. The cookie holds a random token; only its hash is stored. */
@Injectable()
export class SessionsRepository {
  /** Starts a new session (a fresh token on every sign-in) and returns the token. */
  async create(tx: pg.PoolClient, userId: string): Promise<string> {
    const token = newToken();
    await tx.query(
      `insert into identity.sessions (token_hash, user_id, expires_at)
       values ($1, $2, now() + make_interval(secs => $3))`,
      [hashToken(token), userId, SESSION_ABSOLUTE_MS / 1000],
    );
    return token;
  }

  /** The signed-in user for a token, or null if it is unknown, revoked, idle or expired. */
  async resolve(tx: pg.PoolClient, token: string): Promise<AuthContext | null> {
    const { rows } = await tx.query<{ user_id: string; mfa_verified: boolean }>(
      `update identity.sessions
          set last_seen_at = now()
        where token_hash = $1
          and revoked_at is null
          and expires_at > now()
          and last_seen_at > now() - make_interval(secs => $2)
       returning user_id,
                 coalesce(mfa_verified_at > now() - make_interval(secs => $3), false) as mfa_verified`,
      [hashToken(token), SESSION_IDLE_MS / 1000, MFA_STEP_UP_MS / 1000],
    );
    const row = rows[0];
    return row ? { userId: row.user_id, mfaVerified: row.mfa_verified } : null;
  }

  /** Records a passed MFA check on this session (counts for MFA_STEP_UP_MS). */
  async markMfaVerified(tx: pg.PoolClient, token: string): Promise<void> {
    await tx.query('update identity.sessions set mfa_verified_at = now() where token_hash = $1', [
      hashToken(token),
    ]);
  }

  async revoke(tx: pg.PoolClient, token: string): Promise<void> {
    await tx.query(
      'update identity.sessions set revoked_at = now() where token_hash = $1 and revoked_at is null',
      [hashToken(token)],
    );
  }
}
