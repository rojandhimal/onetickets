import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { MfaCode, RecoveryCodes, TotpSetup } from '@onetickets/shared';
import { Secret, TOTP } from 'otpauth';
import type pg from 'pg';
import { UnitOfWork } from '../../database/database.module.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { ApiError } from './errors.js';
import { RateLimiter } from './rate-limiter.js';
import { hashToken, rateKey } from './secrets.js';

const STEP_SECONDS = 30;
const RECOVERY_CODE_COUNT = 10;

const invalidCode = () =>
  new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_code', 'That code did not work.', 'code');

/** Authenticator-app MFA: enrolment, recovery codes and step-up checks. */
@Injectable()
export class MfaService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly uow: UnitOfWork,
    private readonly limiter: RateLimiter,
  ) {}

  /** Starts enrolment with a new secret. Replaces an unconfirmed one. */
  async setup(userId: string): Promise<TotpSetup> {
    return this.uow.run({ userId }, async (tx) => {
      const user = await this.user(tx, userId);
      if (user.mfa_enabled) {
        throw new ApiError(HttpStatus.CONFLICT, 'mfa_already_enabled', 'MFA is already on.');
      }
      const secret = new Secret({ size: 20 });
      await tx.query(
        'update identity.users set totp_secret_enc = $2, totp_last_step = null where id = $1',
        [userId, this.encrypt(secret.base32)],
      );
      return {
        secret: secret.base32,
        otpauthUrl: this.totp(secret.base32, user.email).toString(),
      };
    });
  }

  /** Confirms enrolment with a first code and returns one-time recovery codes. */
  async confirm(userId: string, code: string): Promise<RecoveryCodes> {
    await this.limitAttempts(userId);
    return this.uow.run({ userId }, async (tx) => {
      const user = await this.user(tx, userId);
      if (user.mfa_enabled || !user.totp_secret_enc) throw invalidCode();
      await this.acceptTotp(tx, userId, user, code);
      await tx.query('update identity.users set mfa_enabled_at = now() where id = $1', [userId]);

      const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
        randomBytes(8).toString('hex'),
      );
      await tx.query('delete from identity.mfa_recovery_codes where user_id = $1', [userId]);
      for (const recoveryCode of recoveryCodes) {
        await tx.query(
          'insert into identity.mfa_recovery_codes (user_id, code_hash) values ($1, $2)',
          [userId, hashToken(recoveryCode)],
        );
      }
      return { recoveryCodes };
    });
  }

  /** Checks a code for step-up. Throws if it does not match; a recovery code is used up. */
  async verify(userId: string, input: MfaCode): Promise<void> {
    await this.limitAttempts(userId);
    await this.uow.run({ userId }, async (tx) => {
      const user = await this.user(tx, userId);
      if (!user.mfa_enabled) {
        throw new ApiError(HttpStatus.CONFLICT, 'mfa_not_enabled', 'Set up MFA first.');
      }
      if ('code' in input) {
        await this.acceptTotp(tx, userId, user, input.code);
        return;
      }
      const { rowCount } = await tx.query(
        `update identity.mfa_recovery_codes set used_at = now()
          where user_id = $1 and code_hash = $2 and used_at is null`,
        [userId, hashToken(input.recoveryCode.toLowerCase())],
      );
      if (!rowCount) throw invalidCode();
    });
  }

  private async acceptTotp(tx: pg.PoolClient, userId: string, user: UserRow, code: string) {
    const totp = this.totp(this.decrypt(user.totp_secret_enc!), user.email);
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) throw invalidCode();
    const step = Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta;
    // Each step's code is accepted once.
    const { rowCount } = await tx.query(
      `update identity.users set totp_last_step = $2
        where id = $1 and (totp_last_step is null or totp_last_step < $2)`,
      [userId, step],
    );
    if (!rowCount) throw invalidCode();
  }

  private async limitAttempts(userId: string): Promise<void> {
    await this.limiter.hit({ key: rateKey('mfa:user', userId), max: 10, windowMs: 15 * 60_000 });
  }

  private async user(tx: pg.PoolClient, userId: string): Promise<UserRow> {
    const { rows } = await tx.query<UserRow>(
      `select email, totp_secret_enc, mfa_enabled_at is not null as mfa_enabled
         from identity.users where id = $1`,
      [userId],
    );
    return rows[0]!;
  }

  private totp(base32: string, email: string): TOTP {
    return new TOTP({
      issuer: 'OneTickets',
      label: email,
      secret: Secret.fromBase32(base32),
      period: STEP_SECONDS,
    });
  }

  private encrypt(plain: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.config.mfaKey, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }

  private decrypt(blob: Buffer): string {
    const decipher = createDecipheriv('aes-256-gcm', this.config.mfaKey, blob.subarray(0, 12));
    decipher.setAuthTag(blob.subarray(12, 28));
    return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8');
  }
}

interface UserRow {
  email: string;
  totp_secret_enc: Buffer | null;
  mfa_enabled: boolean;
}
