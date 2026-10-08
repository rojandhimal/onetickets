import { Injectable } from '@nestjs/common';
import type { MemberDto, OrganisationDto, Role } from '@onetickets/shared';
import type pg from 'pg';

/** SQL for the identity schema. Every call runs inside a UnitOfWork transaction. */
@Injectable()
export class MembershipsRepository {
  async roleOf(tx: pg.PoolClient, organisationId: string, userId: string): Promise<Role | null> {
    const { rows } = await tx.query<{ role: Role }>(
      'select role from identity.memberships where organisation_id = $1 and user_id = $2',
      [organisationId, userId],
    );
    return rows[0]?.role ?? null;
  }

  async createOrganisation(tx: pg.PoolClient, id: string, name: string, ownerId: string) {
    await tx.query('insert into identity.organisations (id, name) values ($1, $2)', [id, name]);
    await tx.query(
      `insert into identity.memberships (organisation_id, user_id, role) values ($1, $2, 'owner')`,
      [id, ownerId],
    );
  }

  async organisationsFor(tx: pg.PoolClient, userId: string): Promise<OrganisationDto[]> {
    const { rows } = await tx.query<OrganisationDto>(
      `select o.id, o.name, m.role
         from identity.memberships m
         join identity.organisations o on o.id = m.organisation_id
        where m.user_id = $1
        order by o.created_at`,
      [userId],
    );
    return rows;
  }

  async members(tx: pg.PoolClient, organisationId: string): Promise<MemberDto[]> {
    const { rows } = await tx.query<MemberDto>(
      `select u.id as "userId", u.email, m.role, to_char(m.created_at at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "joinedAt"
         from identity.memberships m
         join identity.users u on u.id = m.user_id
        where m.organisation_id = $1
        order by m.created_at`,
      [organisationId],
    );
    return rows;
  }

  /** Adds a member, creating their user if needed. Returns null if they are already a member. */
  async addMember(
    tx: pg.PoolClient,
    organisationId: string,
    email: string,
    role: Role,
  ): Promise<MemberDto | null> {
    const { rows: users } = await tx.query<{ id: string }>(
      'select identity.ensure_user($1) as id',
      [email],
    );
    const userId = users[0]!.id;
    const { rows } = await tx.query<{ joinedAt: string }>(
      `insert into identity.memberships (organisation_id, user_id, role) values ($1, $2, $3)
       on conflict do nothing
       returning to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "joinedAt"`,
      [organisationId, userId, role],
    );
    if (!rows[0]) return null;
    return { userId, email, role, joinedAt: rows[0].joinedAt };
  }
}
