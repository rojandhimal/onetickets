/**
 * Organisation roles and what each may do. The api enforces these; the web app uses the same
 * map to decide what to show, so the two can never disagree.
 */
export const ROLES = ['owner', 'admin', 'finance', 'door_staff'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  /** Sales figures, orders, refunds. Door staff never see money. */
  viewMoney: ['owner', 'admin', 'finance'],
  /** Payout settings and payout history. Also needs a recent MFA check. */
  managePayouts: ['owner', 'finance'],
  /** Invite staff and change their roles. */
  manageMembers: ['owner', 'admin'],
  /** Bulk attendee CSV export. Also needs a recent MFA check. */
  exportData: ['owner', 'admin', 'finance'],
  /** Check tickets in at the door. */
  scanTickets: ['owner', 'admin', 'finance', 'door_staff'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Permissions that also require the session to have passed MFA (step-up). Refunds above a
 * threshold and account email changes join this when they are built (Sprint 5, S0-3).
 */
export const MFA_REQUIRED: readonly Permission[] = ['managePayouts', 'exportData'];

/** Only owners may hand out the roles that reach money or ownership, and only after MFA. */
export const OWNER_ONLY_GRANTS: readonly Role[] = ['owner', 'finance'];

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function canGrant(granter: Role, role: Role): boolean {
  if (!can(granter, 'manageMembers')) return false;
  return granter === 'owner' || !OWNER_ONLY_GRANTS.includes(role);
}
