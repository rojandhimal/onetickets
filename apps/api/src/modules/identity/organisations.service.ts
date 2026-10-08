import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { canGrant, type MemberDto, type OrganisationDto, type Role } from '@onetickets/shared';
import { HttpStatus } from '@nestjs/common';
import { UnitOfWork } from '../../database/database.module.js';
import { ApiError, forbidden } from './errors.js';
import { MembershipsRepository } from './memberships.repository.js';

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly memberships: MembershipsRepository,
  ) {}

  /** Creates an organisation with the caller as its owner. */
  async create(userId: string, name: string): Promise<OrganisationDto> {
    const id = randomUUID();
    await this.uow.run({ organisationId: id, userId }, (tx) =>
      this.memberships.createOrganisation(tx, id, name, userId),
    );
    return { id, name, role: 'owner' };
  }

  async listFor(userId: string): Promise<OrganisationDto[]> {
    return this.uow.run({ userId }, (tx) => this.memberships.organisationsFor(tx, userId));
  }

  async members(organisationId: string, userId: string): Promise<MemberDto[]> {
    return this.uow.run({ organisationId, userId }, (tx) =>
      this.memberships.members(tx, organisationId),
    );
  }

  async addMember(
    organisationId: string,
    granter: { userId: string; role: Role },
    email: string,
    role: Role,
  ): Promise<MemberDto> {
    if (!canGrant(granter.role, role)) throw forbidden();
    const member = await this.uow.run({ organisationId, userId: granter.userId }, (tx) =>
      this.memberships.addMember(tx, organisationId, email, role),
    );
    if (!member) {
      throw new ApiError(HttpStatus.CONFLICT, 'already_a_member', `${email} is already a member.`);
    }
    return member;
  }
}
