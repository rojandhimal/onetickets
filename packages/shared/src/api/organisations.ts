import { z } from 'zod';
import { ROLES } from '../roles.js';

/** API contract for organisations and members (S0-4). Shared by api and web. */

export const roleSchema = z.enum(ROLES);

export const createOrganisationRequest = z.object({
  name: z.string().trim().min(1).max(120),
});
export type CreateOrganisationRequest = z.infer<typeof createOrganisationRequest>;

export const addMemberRequest = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  role: roleSchema,
});
export type AddMemberRequest = z.infer<typeof addMemberRequest>;

/** An organisation as seen by one of its members. */
export interface OrganisationDto {
  id: string;
  name: string;
  role: z.infer<typeof roleSchema>;
}

export interface MemberDto {
  userId: string;
  email: string;
  role: z.infer<typeof roleSchema>;
  joinedAt: string;
}

export interface ApiErrorBody {
  statusCode: number;
  /** Stable machine-readable code, e.g. `mfa_required`, `not_a_member`. */
  code: string;
  message: string;
}
