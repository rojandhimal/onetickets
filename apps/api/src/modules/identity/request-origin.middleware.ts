import { HttpStatus, Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { ApiError } from './errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie sessions, alongside SameSite=Lax: a state-changing request must come
 * from the web app's origin and, if it has a body, be JSON (which cross-site forms cannot send
 * without a CORS preflight). Webhooks that need an exemption will register their own route.
 */
@Injectable()
export class RequestOriginMiddleware implements NestMiddleware {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) return next();

    if (request.headers.origin !== this.config.webUrl) {
      return next(new ApiError(HttpStatus.FORBIDDEN, 'bad_origin', 'Request origin not allowed.'));
    }
    const hasBody = Number(request.headers['content-length'] ?? 0) > 0;
    if (hasBody && !request.is('application/json')) {
      return next(
        new ApiError(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'unsupported_media_type',
          'Send JSON with Content-Type: application/json.',
        ),
      );
    }
    next();
  }
}
