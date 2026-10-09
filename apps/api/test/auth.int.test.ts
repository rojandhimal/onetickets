import 'reflect-metadata';
import { createHash, randomInt } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { OutboxMailer, Mailer } from '../src/modules/notifications/index.js';
import { uniqueEmail, withOwner } from './db.js';

const WEB = 'http://localhost:3000';

describe('sign-in API (S0-3)', () => {
  let app: INestApplication;
  let outbox: OutboxMailer;

  // A fresh client IP per call keeps the per-IP limits out of the way of unrelated tests.
  const ip = () => `203.0.113.${randomInt(1, 255)}`;
  const post = (path: string, body: object, headers: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .post(path)
      .set({ origin: WEB, 'x-forwarded-for': ip(), ...headers })
      .send(body);

  async function requestLink(email: string, organiserName?: string): Promise<string> {
    await post('/auth/magic-link', { email, organiserName }).expect(202);
    const text = outbox.lastTo(email.toLowerCase())?.text ?? '';
    const match = text.match(/\/auth\/verify#token=([\w-]+)/);
    if (!match) throw new Error(`no sign-in link mailed to ${email}`);
    return match[1]!;
  }

  async function signIn(email: string, organiserName?: string) {
    const token = await requestLink(email, organiserName);
    const response = await post('/auth/magic-link/verify', { token }).expect(200);
    const cookie = response.headers['set-cookie']![0]!.split(';')[0]!;
    return { session: response.body, cookie, setCookie: response.headers['set-cookie']![0]! };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    (app as NestExpressApplication).set('trust proxy', 1);
    await app.init();
    outbox = app.get(Mailer) as OutboxMailer;
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up with just an email and organiser name, and lands in that organisation', async () => {
    const email = uniqueEmail('priya');
    const token = await requestLink(email, 'Priya’s Workshops');
    expect(outbox.lastTo(email)!.text).toContain(`${WEB}/auth/verify#token=${token}`);

    const response = await post('/auth/magic-link/verify', { token }).expect(200);
    expect(response.body).toMatchObject({
      user: { email, name: null, mfaEnabled: false },
      organisation: { name: 'Priya’s Workshops', role: 'owner' },
    });
    expect(response.body.organisations).toHaveLength(1);

    const setCookie = response.headers['set-cookie']![0]!;
    expect(setCookie).toMatch(/^ot_session=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);

    const me = await request(app.getHttpServer())
      .get('/me')
      .set('cookie', setCookie.split(';')[0]!)
      .expect(200);
    expect(me.body).toEqual(response.body);
  });

  it('leaves a new user without an organisation when no name was given', async () => {
    const { session } = await signIn(uniqueEmail('sam'));
    expect(session.organisation).toBeNull();
    expect(session.organisations).toEqual([]);
  });

  it('stores only a hash of the link token', async () => {
    const email = uniqueEmail('hash');
    const token = await requestLink(email);
    const stored = await withOwner(async (client) => {
      const { rows } = await client.query<{ token_hash: Buffer }>(
        'select token_hash from identity.magic_links where email = $1',
        [email],
      );
      return rows.map((row) => row.token_hash.toString('hex'));
    });
    expect(stored).toEqual([createHash('sha256').update(token).digest('hex')]);
  });

  it('answers the same for new and existing emails', async () => {
    const existing = uniqueEmail('known');
    await signIn(existing, 'Known');
    const known = await post('/auth/magic-link', { email: existing }).expect(202);
    const unknown = await post('/auth/magic-link', { email: uniqueEmail('new') }).expect(202);
    expect(known.text).toBe('');
    expect(unknown.text).toBe('');
  });

  it('works once', async () => {
    const token = await requestLink(uniqueEmail('once'));
    await post('/auth/magic-link/verify', { token }).expect(200);
    const again = await post('/auth/magic-link/verify', { token }).expect(410);
    expect(again.body.code).toBe('link_used');
  });

  it('expires after 15 minutes', async () => {
    const email = uniqueEmail('late');
    const token = await requestLink(email);
    await withOwner((client) =>
      client.query(
        `update identity.magic_links set expires_at = now() - interval '1 second' where email = $1`,
        [email],
      ),
    );
    const response = await post('/auth/magic-link/verify', { token }).expect(410);
    expect(response.body.code).toBe('link_expired');
  });

  it('is replaced by a newer link', async () => {
    const email = uniqueEmail('twice');
    const first = await requestLink(email);
    const second = await requestLink(email);
    expect((await post('/auth/magic-link/verify', { token: first }).expect(410)).body.code).toBe(
      'link_used',
    );
    await post('/auth/magic-link/verify', { token: second }).expect(200);
  });

  it('rejects a made-up token', async () => {
    const response = await post('/auth/magic-link/verify', { token: 'not-a-real-token' }).expect(
      410,
    );
    expect(response.body.code).toBe('link_invalid');
  });

  it('never renames or duplicates an existing organisation', async () => {
    const email = uniqueEmail('tom');
    await signIn(email, 'Tom’s Gigs');
    const { session } = await signIn(email, 'Someone Else’s Name');
    expect(session.organisations).toEqual([
      expect.objectContaining({ name: 'Tom’s Gigs', role: 'owner' }),
    ]);
  });

  it('signs an invited staff member into the organisation that invited them', async () => {
    const owner = await signIn(uniqueEmail('owner'), 'Inviting Org');
    const orgId = owner.session.organisation.id;
    const staff = uniqueEmail('door');
    await post(
      `/organisations/${orgId}/members`,
      { email: staff, role: 'door_staff' },
      {
        cookie: owner.cookie,
      },
    ).expect(201);

    const { session } = await signIn(staff, 'Should Be Ignored');
    expect(session.organisations).toEqual([
      { id: orgId, name: 'Inviting Org', role: 'door_staff' },
    ]);
  });

  it('validates input with a field name', async () => {
    const response = await post('/auth/magic-link', { email: 'not-an-email' }).expect(422);
    expect(response.body).toMatchObject({ code: 'invalid_request', field: 'email' });
  });

  it('refuses state-changing requests from other origins or as forms', async () => {
    const email = uniqueEmail('csrf');
    const foreign = await post('/auth/magic-link', { email }, { origin: 'https://evil.example' });
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe('bad_origin');

    const form = await request(app.getHttpServer())
      .post('/auth/magic-link')
      .set({ origin: WEB, 'x-forwarded-for': ip() })
      .type('form')
      .send({ email });
    expect(form.status).toBe(415);
  });

  it('rate-limits links per email', async () => {
    const email = uniqueEmail('spam');
    for (let i = 0; i < 5; i++) await post('/auth/magic-link', { email }).expect(202);
    const response = await post('/auth/magic-link', { email }).expect(429);
    expect(response.body.code).toBe('rate_limited');
  });

  it('rate-limits link redemption per IP', async () => {
    const attacker = `2001:db8::${randomInt(1, 0xffff).toString(16)}:${randomInt(1, 0xffff).toString(16)}`;
    const guess = () =>
      post('/auth/magic-link/verify', { token: 'guess' }, { 'x-forwarded-for': attacker });
    for (let i = 0; i < 30; i++) await guess().expect(410);
    expect((await guess().expect(429)).body.code).toBe('rate_limited');
  });

  it('signs out by revoking the session server-side', async () => {
    const { cookie } = await signIn(uniqueEmail('bye'), 'Bye');
    await post('/auth/sign-out', {}, { cookie }).expect(204);
    const me = await request(app.getHttpServer()).get('/me').set('cookie', cookie).expect(401);
    expect(me.body.code).toBe('not_signed_in');
  });

  it('ends idle sessions', async () => {
    const { cookie, session } = await signIn(uniqueEmail('idle'), 'Idle');
    await withOwner((client) =>
      client.query(
        `update identity.sessions set last_seen_at = now() - interval '8 days' where user_id = $1`,
        [session.user.id],
      ),
    );
    await request(app.getHttpServer()).get('/me').set('cookie', cookie).expect(401);
  });

  describe('MFA with an authenticator app', () => {
    const codeFor = (secret: string) =>
      new TOTP({ secret: Secret.fromBase32(secret), period: 30 }).generate();

    it('is required before granting finance, and enrolling satisfies it', async () => {
      const owner = await signIn(uniqueEmail('mfa-owner'), 'MFA Org');
      const orgId = owner.session.organisation.id;
      const grant = () =>
        post(
          `/organisations/${orgId}/members`,
          { email: uniqueEmail('fin'), role: 'finance' },
          { cookie: owner.cookie },
        );
      expect((await grant().expect(403)).body.code).toBe('mfa_required');

      const setup = await post('/me/mfa/totp/setup', {}, { cookie: owner.cookie }).expect(200);
      expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/OneTickets:/);
      const confirm = await post(
        '/me/mfa/totp/confirm',
        { code: codeFor(setup.body.secret) },
        { cookie: owner.cookie },
      ).expect(200);
      expect(confirm.body.recoveryCodes).toHaveLength(10);

      await grant().expect(201);
      const me = await request(app.getHttpServer()).get('/me').set('cookie', owner.cookie);
      expect(me.body.user.mfaEnabled).toBe(true);
    });

    it('rejects a wrong code and a replayed code', async () => {
      const email = uniqueEmail('mfa-replay');
      const { cookie } = await signIn(email, 'Replay');
      const { body } = await post('/me/mfa/totp/setup', {}, { cookie }).expect(200);
      await post('/me/mfa/totp/confirm', { code: '000000' }, { cookie }).expect(422);
      const code = codeFor(body.secret);
      await post('/me/mfa/totp/confirm', { code }, { cookie }).expect(200);

      const replay = await post('/auth/mfa/verify', { code }, { cookie }).expect(422);
      expect(replay.body.code).toBe('invalid_code');
    });

    it('needs a fresh check on a new session, and a recovery code works once', async () => {
      const email = uniqueEmail('mfa-recover');
      const first = await signIn(email, 'Recover');
      const { body } = await post('/me/mfa/totp/setup', {}, { cookie: first.cookie });
      const { body: codes } = await post(
        '/me/mfa/totp/confirm',
        { code: codeFor(body.secret) },
        { cookie: first.cookie },
      ).expect(200);

      const second = await signIn(email);
      const orgId = second.session.organisation.id;
      const grant = () =>
        post(
          `/organisations/${orgId}/members`,
          { email: uniqueEmail('own'), role: 'owner' },
          { cookie: second.cookie },
        );
      expect((await grant().expect(403)).body.code).toBe('mfa_required');

      const recoveryCode = codes.recoveryCodes[0];
      await post('/auth/mfa/verify', { recoveryCode }, { cookie: second.cookie }).expect(204);
      await grant().expect(201);
      await post('/auth/mfa/verify', { recoveryCode }, { cookie: second.cookie }).expect(422);
    });

    it('cannot be set up twice', async () => {
      const { cookie } = await signIn(uniqueEmail('mfa-twice'), 'Twice');
      const { body } = await post('/me/mfa/totp/setup', {}, { cookie });
      await post('/me/mfa/totp/confirm', { code: codeFor(body.secret) }, { cookie }).expect(200);
      const again = await post('/me/mfa/totp/setup', {}, { cookie }).expect(409);
      expect(again.body.code).toBe('mfa_already_enabled');
    });
  });
});
