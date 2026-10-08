import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MFA_REQUIRED, can, type Permission } from '@onetickets/shared';
import { UnitOfWork } from '../../database/database.module.js';
import type { AppRequest } from './auth-context.js';
import { forbidden, mfaRequired, notAMember, notSignedIn } from './errors.js';
import { MembershipsRepository } from './memberships.repository.js';

const PERMISSION_KEY = 'identity:permission';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves `:organisationId` from the route to the caller's membership and checks the
 * permission named by @OrganisationAccess. Sets `request.organisation` for the handler.
 */
@Injectable()
export class OrganisationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly uow: UnitOfWork,
    private readonly memberships: MembershipsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const auth = request.auth;
    if (!auth) throw notSignedIn();

    const organisationId = request.params.organisationId;
    if (typeof organisationId !== 'string' || !UUID.test(organisationId)) throw notAMember();

    const role = await this.uow.run({ organisationId, userId: auth.userId }, (tx) =>
      this.memberships.roleOf(tx, organisationId, auth.userId),
    );
    if (!role) throw notAMember();

    if (permission) {
      if (!can(role, permission)) throw forbidden();
      if (MFA_REQUIRED.includes(permission) && !auth.mfaVerified) throw mfaRequired();
    }

    request.organisation = { id: organisationId, role };
    return true;
  }
}

/**
 * Requires membership of the route's `:organisationId`, and the given permission if any.
 * Permissions in MFA_REQUIRED (payouts) also need an MFA-verified session.
 */
export const OrganisationAccess = (permission?: Permission) =>
  applyDecorators(SetMetadata(PERMISSION_KEY, permission), UseGuards(OrganisationAccessGuard));
