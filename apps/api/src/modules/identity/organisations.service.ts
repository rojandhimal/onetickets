import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canGrant,
  OWNER_ONLY_GRANTS,
  type MemberDto,
  type OrganisationDto,
  type Role,
} from '@onetickets/shared';
import { UnitOfWork } from '../../database/database.module.js';
import { ApiError, forbidden, mfaRequired } from './errors.js';
import { MembershipsRepository } from './memberships.repository.js';

export interface Granter {
  userId: string;
  role: Role;
  mfaVerified: boolean;
}

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly memberships: MembershipsRepository,
  ) {}

  /** Creates an organisation with the caller as its owner. */
  async create(userId: string, name: string): Promise<OrganisationDto> {
    const id = randomUUID();
    await this.uow.run({ organisationId: id, userId }, async (tx) => {
      await this.memberships.createOrganisation(tx, id, name, userId);
      await this.memberships.audit(tx, id, userId, 'organisation.created', userId, { name });
    });
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

  /** Adds a member. Granting owner or finance needs an owner who has just passed MFA. */
  async addMember(
    organisationId: string,
    granter: Granter,
    email: string,
    role: Role,
  ): Promise<MemberDto> {
    if (!canGrant(granter.role, role)) throw forbidden();
    if (OWNER_ONLY_GRANTS.includes(role) && !granter.mfaVerified) throw mfaRequired();

    const member = await this.uow.run({ organisationId, userId: granter.userId }, async (tx) => {
      const added = await this.memberships.addMember(tx, organisationId, email, role);
      if (added) {
        await this.memberships.audit(
          tx,
          organisationId,
          granter.userId,
          'member.added',
          added.userId,
          {
            role,
          },
        );
      }
      return added;
    });
    if (!member) {
      throw new ApiError(HttpStatus.CONFLICT, 'already_a_member', `${email} is already a member.`);
    }
    // TODO(S0-3): email the owners about role changes once Notifications can send mail.
    return member;
  }
}
