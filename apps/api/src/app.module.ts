import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { loggerParams } from './observability/logging.js';

@Module({
  imports: [
    // First, so request logging and its context wrap every other module's middleware.
    LoggerModule.forRoot(loggerParams()),
    SentryModule.forRoot(),
    DatabaseModule,
    HealthModule,
    IdentityModule,
  ],
  // Reports unexpected errors to Sentry; ApiError and other HttpExceptions are expected and skipped.
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}
