import { Injectable } from '@nestjs/common';
import type { AttendeeSession } from '@onetickets/shared';
import type pg from 'pg';
import { MAGIC_LINK_TTL_MS, SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from './auth.config.js';
import { hashToken, newToken } from './secrets.js';

/** Attendee credentials never create or resolve an organiser identity. */
@Injectable()
export class AttendeeAuthRepository {
  async issue(tx: pg.PoolClient, email: string): Promise<string> {
    // Serialise even the first pair of requests, when there is no earlier row to lock.
    await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [email]);
    await tx.query(
      'update identity.attendee_links set used_at = now() where email = $1 and used_at is null',
      [email],
    );
    const token = newToken();
    await tx.query(
      `insert into identity.attendee_links (token_hash, email, expires_at)
       values ($1, $2, now() + make_interval(secs => $3))`,
      [hashToken(token), email, MAGIC_LINK_TTL_MS / 1000],
    );
    return token;
  }

  async redeem(tx: pg.PoolClient, token: string): Promise<string | null> {
    const { rows } = await tx.query<{ email: string }>(
      `update identity.attendee_links set used_at = now()
       where token_hash = $1 and used_at is null and expires_at > now()
       returning email`,
      [hashToken(token)],
    );
    return rows[0]?.email ?? null;
  }

  async createSession(tx: pg.PoolClient, email: string) {
    const token = newToken();
    const { rows } = await tx.query<{ expires_at: Date }>(
      `insert into identity.attendee_sessions (token_hash, email, expires_at)
       values ($1, $2, now() + make_interval(secs => $3)) returning expires_at`,
      [hashToken(token), email, SESSION_ABSOLUTE_MS / 1000],
    );
    return { token, session: sessionDto(email, rows[0]!.expires_at) };
  }

  async resolve(tx: pg.PoolClient, token: string): Promise<AttendeeSession | null> {
    const { rows } = await tx.query<{ email: string; expires_at: Date }>(
      `update identity.attendee_sessions set last_seen_at = now()
       where token_hash = $1 and revoked_at is null and expires_at > now()
         and last_seen_at > now() - make_interval(secs => $2)
       returning email, expires_at`,
      [hashToken(token), SESSION_IDLE_MS / 1000],
    );
    const row = rows[0];
    return row ? sessionDto(row.email, row.expires_at) : null;
  }

  async revoke(tx: pg.PoolClient, token: string): Promise<void> {
    await tx.query(
      `update identity.attendee_sessions set revoked_at = now()
       where token_hash = $1 and revoked_at is null`,
      [hashToken(token)],
    );
  }
}

function sessionDto(email: string, expiresAt: Date): AttendeeSession {
  return { email, expiresAt: expiresAt.toISOString(), permissions: ['tickets:read'] };
}
