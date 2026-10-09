import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessGuard } from './access.js';
import { MembershipsRepository } from './memberships.repository.js';
import { OrganisationsController } from './organisations.controller.js';
import { OrganisationsService } from './organisations.service.js';

@Module({
  controllers: [OrganisationsController],
  providers: [
    MembershipsRepository,
    OrganisationsService,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class IdentityModule {}
