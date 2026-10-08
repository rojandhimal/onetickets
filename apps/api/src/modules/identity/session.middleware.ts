import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { parseCookie } from 'cookie';
import type { NextFunction, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig, sessionCookieName } from './auth.config.js';
import type { AppRequest } from './auth-context.js';
import { AuthService } from './auth.service.js';

/** Reads the session cookie and sets `request.auth` when it names a live session. */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly auth: AuthService,
  ) {}

  async use(request: AppRequest, _response: Response, next: NextFunction): Promise<void> {
    try {
      const token = sessionToken(request, this.config);
      if (token) request.auth = (await this.auth.resolveSession(token)) ?? undefined;
      next();
    } catch (error) {
      next(error);
    }
  }
}

export function sessionToken(request: AppRequest, config: AuthConfig): string | undefined {
  const header = request.headers.cookie;
  return header ? parseCookie(header)[sessionCookieName(config)] : undefined;
}
