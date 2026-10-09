import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/index.js';
import { IdentityModule } from './modules/identity/index.js';

@Module({
  imports: [DatabaseModule, HealthModule, IdentityModule],
})
export class AppModule {}
