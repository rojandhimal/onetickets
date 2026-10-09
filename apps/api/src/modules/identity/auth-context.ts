import type { Role } from '@onetickets/shared';
import type { Request } from 'express';

/** The signed-in user. Set by the session middleware (S0-3); absent means not signed in. */
export interface AuthContext {
  userId: string;
  /** True when this session passed an MFA check recently enough for sensitive screens. */
  mfaVerified: boolean;
}

/** The organisation a request acts in, resolved from the route by OrganisationAccessGuard. */
export interface OrganisationContext {
  id: string;
  role: Role;
}

export interface AppRequest extends Request {
  auth?: AuthContext;
  organisation?: OrganisationContext;
}
