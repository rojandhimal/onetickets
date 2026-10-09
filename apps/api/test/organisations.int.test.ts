import 'reflect-metadata';
import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import {
  type AppRequest,
  IdentityModule,
  OrganisationAccess,
} from '../src/modules/identity/index.js';
import { seedUser, uniqueEmail, withOwner } from './db.js';

// Stands in for a payout screen until payouts exist (Sprint 7).
@Controller()
class PayoutProbeController {
  @Get('organisations/:organisationId/payout-probe')
  @OrganisationAccess('managePayouts')
  probe() {
    return { ok: true };
  }

  // Deliberately declares no access policy.
  @Get('forgotten-route')
  forgotten() {
    return { ok: true };
  }
}

@Module({ imports: [IdentityModule], controllers: [PayoutProbeController] })
class PayoutProbeModule {}

describe('organisations and roles API', () => {
  let app: INestApplication;
  let owner: string;
  let stranger: string;

  // Sessions arrive with S0-3. Until then tests sign in with headers, test-only.
  function as(userId: string, { mfa = false } = {}) {
    const server = app.getHttpServer();
    const headers = { 'x-test-user': userId, 'x-test-mfa': String(mfa) };
    return {
      get: (path: string) => request(server).get(path).set(headers),
      post: (path: string, body: object) => request(server).post(path).set(headers).send(body),
    };
  }

  async function addMember(organisationId: string, role: string): Promise<string> {
    const email = uniqueEmail(role);
    const response = await as(owner, { mfa: true })
      .post(`/organisations/${organisationId}/members`, { email, role })
      .expect(201);
    return response.body.userId as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, PayoutProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: AppRequest, _res: Response, next: NextFunction) => {
      const userId = req.header('x-test-user');
      if (userId) req.auth = { userId, mfaVerified: req.header('x-test-mfa') === 'true' };
      next();
    });
    await app.init();
    owner = await seedUser(uniqueEmail('owner'));
    stranger = await seedUser(uniqueEmail('stranger'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a route that declares no access policy, even when signed in', async () => {
    const response = await as(owner).get('/forgotten-route').expect(403);
    expect(response.body.code).toBe('no_access_policy');
  });

  it('keeps health public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('requires sign-in', async () => {
    const response = await request(app.getHttpServer()).get('/me/organisations').expect(401);
    expect(response.body.code).toBe('not_signed_in');
  });

  it('makes the creator the owner and lists the organisation for them', async () => {
    const created = await as(owner).post('/organisations', { name: '  Tom’s Gigs  ' }).expect(201);
    expect(created.body).toMatchObject({ name: 'Tom’s Gigs', role: 'owner' });

    const mine = await as(owner).get('/me/organisations').expect(200);
    expect(mine.body).toContainEqual(created.body);
  });

  it('rejects an empty organisation name', async () => {
    const response = await as(owner).post('/organisations', { name: '   ' }).expect(422);
    expect(response.body).toMatchObject({ code: 'invalid_request', field: 'name' });
  });

  it('hides an organisation from non-members', async () => {
    const { body: org } = await as(owner).post('/organisations', { name: 'Private' }).expect(201);
    const response = await as(stranger).get(`/organisations/${org.id}/members`).expect(404);
    expect(response.body.code).toBe('not_a_member');
    await as(stranger).get(`/organisations/not-a-uuid/members`).expect(404);
  });

  it('lets the owner invite staff with a role, once', async () => {
    const { body: org } = await as(owner).post('/organisations', { name: 'Invites' }).expect(201);
    const email = uniqueEmail('door');
    await as(owner)
      .post(`/organisations/${org.id}/members`, { email: email.toUpperCase(), role: 'door_staff' })
      .expect(201);
    const again = await as(owner)
      .post(`/organisations/${org.id}/members`, { email, role: 'admin' })
      .expect(409);
    expect(again.body.code).toBe('already_a_member');

    const members = await as(owner).get(`/organisations/${org.id}/members`).expect(200);
    expect(members.body.map((m: { email: string; role: string }) => [m.email, m.role])).toEqual(
      expect.arrayContaining([[email, 'door_staff']]),
    );
  });

  it('keeps door staff out of member management', async () => {
    const { body: org } = await as(owner).post('/organisations', { name: 'Door' }).expect(201);
    const door = await addMember(org.id, 'door_staff');
    const response = await as(door).get(`/organisations/${org.id}/members`).expect(403);
    expect(response.body.code).toBe('forbidden');
  });

  it('lets only owners grant owner or finance', async () => {
    const { body: org } = await as(owner).post('/organisations', { name: 'Grants' }).expect(201);
    const admin = await addMember(org.id, 'admin');
    await as(admin)
      .post(`/organisations/${org.id}/members`, { email: uniqueEmail('f'), role: 'finance' })
      .expect(403);
    await as(admin)
      .post(`/organisations/${org.id}/members`, { email: uniqueEmail('d'), role: 'door_staff' })
      .expect(201);
    const noMfa = await as(owner)
      .post(`/organisations/${org.id}/members`, { email: uniqueEmail('f'), role: 'finance' })
      .expect(403);
    expect(noMfa.body.code).toBe('mfa_required');
    await as(owner, { mfa: true })
      .post(`/organisations/${org.id}/members`, { email: uniqueEmail('f'), role: 'finance' })
      .expect(201);
  });

  it('audit-logs organisation creation and every member added', async () => {
    const { body: org } = await as(owner).post('/organisations', { name: 'Audit' }).expect(201);
    const door = await addMember(org.id, 'door_staff');
    const events = await withOwner(async (client) => {
      const { rows } = await client.query(
        `select action, actor_user_id, subject_user_id, detail from identity.audit_events
          where organisation_id = $1 order by id`,
        [org.id],
      );
      return rows;
    });
    expect(events).toEqual([
      {
        action: 'organisation.created',
        actor_user_id: owner,
        subject_user_id: owner,
        detail: { name: 'Audit' },
      },
      {
        action: 'member.added',
        actor_user_id: owner,
        subject_user_id: door,
        detail: { role: 'door_staff' },
      },
    ]);
  });

  describe('payout screens', () => {
    let org: string;
    let finance: string;
    let admin: string;
    let door: string;

    beforeAll(async () => {
      org = (await as(owner).post('/organisations', { name: 'Payouts' }).expect(201)).body.id;
      finance = await addMember(org, 'finance');
      admin = await addMember(org, 'admin');
      door = await addMember(org, 'door_staff');
    });

    it('require MFA for owners and finance', async () => {
      const path = `/organisations/${org}/payout-probe`;
      expect((await as(owner).get(path).expect(403)).body.code).toBe('mfa_required');
      expect((await as(finance).get(path).expect(403)).body.code).toBe('mfa_required');
      await as(owner, { mfa: true }).get(path).expect(200);
      await as(finance, { mfa: true }).get(path).expect(200);
    });

    it('are closed to admins and door staff even with MFA', async () => {
      const path = `/organisations/${org}/payout-probe`;
      expect((await as(admin, { mfa: true }).get(path).expect(403)).body.code).toBe('forbidden');
      expect((await as(door, { mfa: true }).get(path).expect(403)).body.code).toBe('forbidden');
    });
  });
});
