import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NotificationsModule } from '../notifications/index.js';
import { AccessGuard } from './access.js';
import { AUTH_CONFIG, loadAuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MagicLinksRepository } from './magic-links.repository.js';
import { MembershipsRepository } from './memberships.repository.js';
import { MfaService } from './mfa.service.js';
import { OrganisationsController } from './organisations.controller.js';
import { OrganisationsService } from './organisations.service.js';
import { RateLimiter } from './rate-limiter.js';
import { RequestOriginMiddleware } from './request-origin.middleware.js';
import { SessionMiddleware } from './session.middleware.js';
import { SessionsRepository } from './sessions.repository.js';

@Module({
  imports: [NotificationsModule],
  controllers: [AuthController, OrganisationsController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => loadAuthConfig() },
    AuthService,
    MagicLinksRepository,
    MembershipsRepository,
    MfaService,
    OrganisationsService,
    RateLimiter,
    SessionsRepository,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class IdentityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestOriginMiddleware, SessionMiddleware).forRoutes('*path');
  }
}
