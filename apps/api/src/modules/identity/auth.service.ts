import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Session } from '@onetickets/shared';
import type pg from 'pg';
import { setScope, UnitOfWork } from '../../database/database.module.js';
import { Mailer } from '../notifications/index.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { AuthContext } from './auth-context.js';
import { ApiError } from './errors.js';
import { MagicLinksRepository } from './magic-links.repository.js';
import { MembershipsRepository } from './memberships.repository.js';
import { RateLimiter } from './rate-limiter.js';
import { rateKey } from './secrets.js';
import { SessionsRepository } from './sessions.repository.js';

const FIFTEEN_MINUTES = 15 * 60_000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly uow: UnitOfWork,
    private readonly limiter: RateLimiter,
    private readonly mailer: Mailer,
    private readonly magicLinks: MagicLinksRepository,
    private readonly sessions: SessionsRepository,
    private readonly memberships: MembershipsRepository,
  ) {}

  /**
   * Emails a sign-in link. Known and unknown emails take the same path and get the same
   * answer, so the response says nothing about who has an account.
   */
  async requestMagicLink(email: string, organiserName: string | null, ip: string): Promise<void> {
    await this.limiter.hit(
      { key: rateKey('link:email', email), max: 5, windowMs: FIFTEEN_MINUTES },
      { key: rateKey('link:ip', ip), max: 30, windowMs: FIFTEEN_MINUTES },
    );
    const token = await this.uow.run({}, (tx) => this.magicLinks.issue(tx, email, organiserName));
    await this.mailer.send({
      to: email,
      subject: 'Your OneTickets sign-in link',
      text: [
        'Use this link to sign in to OneTickets. It works once and expires in 15 minutes.',
        '',
        `${this.config.webUrl}/auth/verify#token=${token}`,
        '',
        "If you didn't ask for this, you can ignore this email.",
      ].join('\n'),
    });
  }

  /** Redeems a link: finds or creates the user, starts a session, returns its token. */
  async verifyMagicLink(
    token: string,
    ip: string,
  ): Promise<{ sessionToken: string; session: Session }> {
    await this.limiter.hit({ key: rateKey('verify:ip', ip), max: 30, windowMs: FIFTEEN_MINUTES });
    const result = await this.uow.run({}, async (tx) => {
      const redemption = await this.magicLinks.redeem(tx, token);
      if (!redemption.ok) return redemption;
      const userId = await this.signInUser(tx, redemption.email, redemption.organiserName);
      const sessionToken = await this.sessions.create(tx, userId);
      return { ok: true as const, sessionToken, session: await this.sessionFor(tx, userId) };
    });
    if (!result.ok) {
      throw new ApiError(HttpStatus.GONE, result.reason, 'This sign-in link no longer works.');
    }
    return { sessionToken: result.sessionToken, session: result.session };
  }

  /**
   * Signs in an email someone else has verified (Google). Same rules as a magic link; the
   * display name fills in the user's name only if they have none.
   */
  async signInVerifiedEmail(
    email: string,
    organiserName: string | null,
    displayName: string | null,
  ): Promise<string> {
    return this.uow.run({}, async (tx) => {
      const userId = await this.signInUser(tx, email, organiserName?.trim().slice(0, 120) || null);
      if (displayName) {
        await tx.query('update identity.users set name = $2 where id = $1 and name is null', [
          userId,
          displayName,
        ]);
      }
      return this.sessions.create(tx, userId);
    });
  }

  async me(auth: AuthContext): Promise<Session> {
    return this.uow.run({ userId: auth.userId }, (tx) => this.sessionFor(tx, auth.userId));
  }

  async resolveSession(token: string): Promise<AuthContext | null> {
    return this.uow.run({}, (tx) => this.sessions.resolve(tx, token));
  }

  async markMfaVerified(token: string): Promise<void> {
    await this.uow.run({}, (tx) => this.sessions.markMfaVerified(tx, token));
  }

  async signOut(token: string): Promise<void> {
    await this.uow.run({}, (tx) => this.sessions.revoke(tx, token));
  }

  /**
   * Finds or creates the user for a verified email. A user with no organisation yet gets one,
   * named from sign-up or after their email; an existing one is never renamed or duplicated.
   */
  private async signInUser(
    tx: pg.PoolClient,
    email: string,
    organiserName: string | null,
  ): Promise<string> {
    const { rows } = await tx.query<{ id: string }>('select identity.ensure_user($1) as id', [
      email,
    ]);
    const userId = rows[0]!.id;
    await setScope(tx, { userId });
    if ((await this.memberships.organisationsFor(tx, userId)).length === 0) {
      // No name yet (e.g. a new email on the sign-in form): use the part before the @.
      // They can rename it later.
      const name = organiserName ?? defaultOrganisationName(email);
      const organisationId = randomUUID();
      await setScope(tx, { userId, organisationId });
      await this.memberships.createOrganisation(tx, organisationId, name, userId);
      await this.memberships.audit(tx, organisationId, userId, 'organisation.created', userId, {
        name,
      });
      await setScope(tx, { userId });
    }
    return userId;
  }

  private async sessionFor(tx: pg.PoolClient, userId: string): Promise<Session> {
    const { rows } = await tx.query<{
      id: string;
      email: string;
      name: string | null;
      mfa_enabled: boolean;
    }>(
      `select id, email, name, mfa_enabled_at is not null as mfa_enabled
         from identity.users where id = $1`,
      [userId],
    );
    const user = rows[0]!;
    const organisations = await this.memberships.organisationsFor(tx, userId);
    return {
      user: { id: user.id, email: user.email, name: user.name, mfaEnabled: user.mfa_enabled },
      organisation: organisations[0] ?? null,
      organisations,
    };
  }
}

export function defaultOrganisationName(email: string): string {
  return email.split('@')[0]!.slice(0, 120) || 'My events';
}
