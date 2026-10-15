import type pg from 'pg';

/**
 * Records who changed what in an organisation, inside the caller's transaction. The transaction
 * must be scoped to that organisation: row-level security refuses anything else.
 */
export async function recordAudit(
  tx: pg.PoolClient,
  organisationId: string,
  actorUserId: string,
  action: string,
  subjectUserId: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await tx.query(
    `insert into identity.audit_events (organisation_id, actor_user_id, action, subject_user_id, detail)
     values ($1, $2, $3, $4, $5)`,
    [organisationId, actorUserId, action, subjectUserId, detail],
  );
}
