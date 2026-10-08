import { Module } from '@nestjs/common';
import { MembershipsRepository } from './memberships.repository.js';
import { OrganisationAccessGuard } from './organisation-access.guard.js';
import { OrganisationsController } from './organisations.controller.js';
import { OrganisationsService } from './organisations.service.js';

@Module({
  controllers: [OrganisationsController],
  providers: [MembershipsRepository, OrganisationAccessGuard, OrganisationsService],
  exports: [MembershipsRepository, OrganisationAccessGuard],
})
export class IdentityModule {}
