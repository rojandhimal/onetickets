import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Apply before origin/auth checks, so failed attendee requests carry the same privacy headers. */
@Injectable()
export class AttendeeHeadersMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    // Nest mounts wildcard middleware beneath a matched path; req.path may be only '/'.
    const path = request.originalUrl.split(/[?#]/, 1)[0]!.toLowerCase();
    if (path === '/attendee' || path.startsWith('/attendee/')) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Referrer-Policy', 'no-referrer');
    }
    next();
  }
}
