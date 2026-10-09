import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import { MAGIC_LINK_TTL_MS } from './auth.config.js';
import { hashToken, newToken } from './secrets.js';

export type Redemption =
  | { ok: true; email: string; organiserName: string | null }
  | { ok: false; reason: 'link_expired' | 'link_used' | 'link_invalid' };

@Injectable()
export class MagicLinksRepository {
  /** Issues a link for an email, superseding any unused earlier link. Returns the token. */
  async issue(tx: pg.PoolClient, email: string, organiserName: string | null): Promise<string> {
    await tx.query(
      'update identity.magic_links set used_at = now() where email = $1 and used_at is null',
      [email],
    );
    const token = newToken();
    await tx.query(
      `insert into identity.magic_links (token_hash, email, organiser_name, expires_at)
       values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [hashToken(token), email, organiserName, MAGIC_LINK_TTL_MS / 1000],
    );
    return token;
  }

  /** Marks a link used, once. Concurrent redemptions of the same token: only one wins. */
  async redeem(tx: pg.PoolClient, token: string): Promise<Redemption> {
    const { rows } = await tx.query<{
      email: string;
      organiser_name: string | null;
      was_used: boolean;
      expired: boolean;
    }>(
      `with link as (
         select token_hash, used_at is not null as was_used, expires_at <= now() as expired
           from identity.magic_links where token_hash = $1 for update
       ), used as (
         update identity.magic_links m set used_at = now()
           from link
          where m.token_hash = link.token_hash and not link.was_used and not link.expired
       )
       select m.email, m.organiser_name, link.was_used, link.expired
         from identity.magic_links m join link using (token_hash)`,
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row) return { ok: false, reason: 'link_invalid' };
    if (row.was_used) return { ok: false, reason: 'link_used' };
    if (row.expired) return { ok: false, reason: 'link_expired' };
    return { ok: true, email: row.email, organiserName: row.organiser_name };
  }
}
