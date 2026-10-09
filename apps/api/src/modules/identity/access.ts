import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MFA_REQUIRED, can, type Permission } from '@onetickets/shared';
import { UnitOfWork } from '../../database/database.module.js';
import type { AppRequest } from './auth-context.js';
import { forbidden, mfaRequired, noAccessPolicy, notAMember, notSignedIn } from './errors.js';
import { MembershipsRepository } from './memberships.repository.js';

type AccessPolicy =
  { kind: 'public' } | { kind: 'signedIn' } | { kind: 'organisation'; permission?: Permission };

const ACCESS_KEY = 'identity:access';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Anyone may call this route. */
export const Public = () => SetMetadata(ACCESS_KEY, { kind: 'public' } satisfies AccessPolicy);

/** Any signed-in user may call this route. */
export const SignedIn = () => SetMetadata(ACCESS_KEY, { kind: 'signedIn' } satisfies AccessPolicy);

/**
 * Only members of the route's `:organisationId` may call this route, and only with the given
 * permission if one is named. Permissions in MFA_REQUIRED also need an MFA-verified session.
 * Sets `request.organisation` for the handler.
 */
export const OrganisationAccess = (permission?: Permission) =>
  SetMetadata(ACCESS_KEY, { kind: 'organisation', permission } satisfies AccessPolicy);

/**
 * Global guard: every route must declare one of the policies above. A route that declares
 * nothing is refused, so a forgotten decorator fails closed instead of open.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly uow: UnitOfWork,
    private readonly memberships: MembershipsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<AccessPolicy | undefined>(ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policy) {
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} has no access policy`,
      );
      throw noAccessPolicy();
    }
    if (policy.kind === 'public') return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    const auth = request.auth;
    if (!auth) throw notSignedIn();
    if (policy.kind === 'signedIn') return true;

    const organisationId = request.params.organisationId;
    if (typeof organisationId !== 'string' || !UUID.test(organisationId)) throw notAMember();

    const role = await this.uow.run({ organisationId, userId: auth.userId }, (tx) =>
      this.memberships.roleOf(tx, organisationId, auth.userId),
    );
    if (!role) throw notAMember();

    const { permission } = policy;
    if (permission) {
      if (!can(role, permission)) throw forbidden();
      if (MFA_REQUIRED.includes(permission) && !auth.mfaVerified) throw mfaRequired();
    }

    request.organisation = { id: organisationId, role };
    return true;
  }
}
