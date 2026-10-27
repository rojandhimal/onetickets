import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AttendeeSession } from '@onetickets/shared';
import { parseCookie } from 'cookie';
import { UnitOfWork } from '../../database/database.module.js';
import { Mailer } from '../notifications/index.js';
import { AttendeeAuthRepository } from './attendee-auth.repository.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { AppRequest } from './auth-context.js';
import { ApiError, challengeFailed, challengeUnavailable } from './errors.js';
import { RateLimiter } from './rate-limiter.js';
import { rateKey } from './secrets.js';
import { Turnstile } from './turnstile.js';

const FIFTEEN_MINUTES = 15 * 60_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class AttendeeAuthService {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly uow: UnitOfWork,
    private readonly repository: AttendeeAuthRepository,
    private readonly limiter: RateLimiter,
    private readonly mailer: Mailer,
    private readonly turnstile: Turnstile,
  ) {}

  assertEnabled(): void {
    if (process.env.FEATURE_ATTENDEE_TICKETS !== 'true') {
      throw new ApiError(HttpStatus.NOT_FOUND, 'not_found', 'Not found.');
    }
  }

  async requestLink(email: string, ip: string, turnstileToken?: string): Promise<void> {
    this.assertEnabled();
    const perIp = { key: rateKey('attendee:link:ip', ip), max: 30, windowMs: FIFTEEN_MINUTES };
    const perEmail = {
      key: rateKey('attendee:link:email', email),
      max: 5,
      windowMs: FIFTEEN_MINUTES,
    };
    if (this.turnstile.enabled) {
      await this.limiter.hit(perIp);
      const outcome = await this.turnstile.verify(turnstileToken);
      if (outcome === 'failed') throw challengeFailed();
      if (outcome === 'unavailable') throw challengeUnavailable();
      await this.limiter.hit(perEmail);
    } else {
      await this.limiter.hit(perEmail, perIp);
    }
    // Share the existing global sign-in mail budget, including its alarm text.
    await this.limiter.hit({
      key: 'link:global',
      max: this.config.magicLinkHourlyCap,
      windowMs: 60 * 60_000,
      rolling: true,
      warning: `Sign-in email cap of ${this.config.magicLinkHourlyCap}/hour reached; refusing more`,
    });
    // Every address takes the same path, including addresses that have never bought tickets.
    const token = await this.uow.run({}, (tx) => this.repository.issue(tx, email));
    try {
      await this.mailer.send({
        to: email,
        subject: 'Your OneTickets tickets',
        confidential: true,
        text: [
          "Here's your link to see your tickets. It works for 15 minutes.",
          '',
          `${this.config.webUrl}/my-tickets/verify#token=${token}`,
          '',
          "If you didn't ask for this, you can ignore this email.",
        ].join('\n'),
      });
    } catch {
      // Mail transport exceptions can contain the full recipient and message. Never rethrow them.
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'attendee_mail_unavailable',
        "We couldn't send the link right now. Try again in a minute.",
      );
    }
  }

  async verifyLink(token: string, request: AppRequest) {
    this.assertEnabled();
    await this.limiter.hit({
      key: rateKey('attendee:verify:ip', request.ip ?? 'unknown'),
      max: 30,
      windowMs: FIFTEEN_MINUTES,
    });
    if (!TOKEN_PATTERN.test(token)) throw invalidLink();
    return this.uow.run({}, async (tx) => {
      const email = await this.repository.redeem(tx, token);
      if (!email) throw invalidLink();
      const previous = attendeeSessionToken(request, this.config);
      if (previous) await this.repository.revoke(tx, previous);
      return this.repository.createSession(tx, email);
    });
  }

  async requireSession(request: AppRequest): Promise<AttendeeSession> {
    this.assertEnabled();
    const token = attendeeSessionToken(request, this.config);
    const session = token
      ? await this.uow.run({}, (tx) => this.repository.resolve(tx, token))
      : null;
    if (!session) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        'attendee_not_signed_in',
        'Use your ticket email link to continue.',
      );
    }
    return session;
  }

  async signOut(request: AppRequest): Promise<void> {
    this.assertEnabled();
    const token = attendeeSessionToken(request, this.config);
    if (token) await this.uow.run({}, (tx) => this.repository.revoke(tx, token));
  }
}

export function attendeeCookieName(config: AuthConfig): string {
  return config.secureCookies ? '__Host-ot_attendee' : 'ot_attendee';
}

function attendeeSessionToken(request: AppRequest, config: AuthConfig): string | undefined {
  const header = request.headers.cookie;
  const token = header ? parseCookie(header)[attendeeCookieName(config)] : undefined;
  return token && TOKEN_PATTERN.test(token) ? token : undefined;
}

function invalidLink(): ApiError {
  return new ApiError(
    HttpStatus.GONE,
    'attendee_link_invalid',
    "That link has expired. Enter your email and we'll send a new one.",
  );
}
