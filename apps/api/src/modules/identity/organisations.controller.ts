import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
  addMemberRequest,
  createOrganisationRequest,
  type AddMemberRequest,
  type CreateOrganisationRequest,
  type MemberDto,
  type OrganisationDto,
} from '@onetickets/shared';
import type { AppRequest, AuthContext, OrganisationContext } from './auth-context.js';
import { notSignedIn } from './errors.js';
import { OrganisationAccess } from './organisation-access.guard.js';
import { OrganisationsService } from './organisations.service.js';
import { ZodBody } from './zod-body.pipe.js';

function signedIn(request: AppRequest): AuthContext {
  if (!request.auth) throw notSignedIn();
  return request.auth;
}

@Controller()
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @Get('me/organisations')
  async mine(@Req() request: AppRequest): Promise<OrganisationDto[]> {
    return this.organisations.listFor(signedIn(request).userId);
  }

  @Post('organisations')
  @HttpCode(201)
  async create(
    @Req() request: AppRequest,
    @Body(new ZodBody(createOrganisationRequest)) body: CreateOrganisationRequest,
  ): Promise<OrganisationDto> {
    return this.organisations.create(signedIn(request).userId, body.name);
  }

  @Get('organisations/:organisationId/members')
  @OrganisationAccess('manageMembers')
  async members(@Req() request: AppRequest): Promise<MemberDto[]> {
    const organisation = request.organisation as OrganisationContext;
    return this.organisations.members(organisation.id, signedIn(request).userId);
  }

  @Post('organisations/:organisationId/members')
  @HttpCode(201)
  @OrganisationAccess('manageMembers')
  async addMember(
    @Req() request: AppRequest,
    @Body(new ZodBody(addMemberRequest)) body: AddMemberRequest,
  ): Promise<MemberDto> {
    const organisation = request.organisation as OrganisationContext;
    return this.organisations.addMember(
      organisation.id,
      { userId: signedIn(request).userId, role: organisation.role },
      body.email,
      body.role,
    );
  }
}
