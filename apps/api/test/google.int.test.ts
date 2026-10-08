import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import {
  GoogleOidc,
  type GoogleAuthRequest,
  type GoogleIdentity,
} from '../src/modules/identity/google-oidc.js';
import { safeReturnTo } from '../src/modules/identity/google-sign-in.service.js';
import { uniqueEmail } from './db.js';

const WEB = 'http://localhost:3000';

/** Stands in for Google: records the auth request and returns whatever identity we set. */
class FakeGoogle extends GoogleOidc {
  configured = true;
  lastRequest?: GoogleAuthRequest;
  identity: GoogleIdentity = { email: '', emailVerified: true, name: null };

  async authorizationUrl(req: GoogleAuthRequest): Promise<URL> {
    this.lastRequest = req;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('state', req.state);
    return url;
  }

  async exchange(callbackUrl: URL, req: GoogleAuthRequest): Promise<GoogleIdentity> {
    expect(callbackUrl.origin + callbackUrl.pathname).toBe(`${WEB}/api/auth/google/callback`);
    expect(req).toEqual(this.lastRequest);
    return this.identity;
  }
}

describe('Google sign-in', () => {
  let app: INestApplication;
  const google = new FakeGoogle();

  function cookieValue(setCookies: string[] | undefined, name: string): string | undefined {
    const raw = setCookies?.find((c) => c.startsWith(`${name}=`))?.split(';')[0];
    return raw?.slice(name.length + 1) || undefined;
  }

  async function start(query = '') {
    const response = await request(app.getHttpServer())
      .get(`/auth/google/start${query}`)
      .expect(302);
    const binding = cookieValue(response.headers['set-cookie'] as unknown as string[], 'ot_oauth');
    return { location: response.headers.location as string, binding };
  }

  async function callback(state: string, binding?: string) {
    const req = request(app.getHttpServer()).get(`/auth/google/callback?code=abc&state=${state}`);
    if (binding) req.set('cookie', `ot_oauth=${binding}`);
    return req.expect(302);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleOidc)
      .useValue(google)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    google.configured = true;
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up a new organiser with a verified Google email and lands on returnTo', async () => {
    const { location, binding } = await start(
      '?organiserName=Mei%27s%20Meetups&returnTo=/organiser/new',
    );
    expect(location).toMatch(/^https:\/\/accounts\.google\.com\//);
    expect(binding).toBeTruthy();

    google.identity = { email: uniqueEmail('mei'), emailVerified: true, name: 'Mei Chen' };
    const done = await callback(google.lastRequest!.state, binding);
    expect(done.headers.location).toBe(`${WEB}/organiser/new`);
    const session = cookieValue(done.headers['set-cookie'] as unknown as string[], 'ot_session');

    const me = await request(app.getHttpServer())
      .get('/me')
      .set('cookie', `ot_session=${session}`)
      .expect(200);
    expect(me.body).toMatchObject({
      user: { email: google.identity.email, name: 'Mei Chen' },
      organisation: { name: "Mei's Meetups", role: 'owner' },
    });
  });

  it('uses PKCE and a fresh state and nonce for each attempt', async () => {
    await start();
    const first = google.lastRequest!;
    await start();
    const second = google.lastRequest!;
    expect(first.codeVerifier).toHaveLength(43);
    expect(new Set([first.state, second.state, first.nonce, second.nonce]).size).toBe(4);
  });

  it('refuses a callback without the browser cookie (login CSRF)', async () => {
    await start();
    google.identity = { email: uniqueEmail('csrf'), emailVerified: true, name: null };
    const done = await callback(google.lastRequest!.state);
    expect(done.headers.location).toBe(`${WEB}/signin?error=google`);
  });

  it('refuses a state that does not match the cookie', async () => {
    const { binding } = await start();
    const done = await callback('someone-elses-state', binding);
    expect(done.headers.location).toBe(`${WEB}/signin?error=google`);
  });

  it('refuses an unverified Google email', async () => {
    const { binding } = await start();
    google.identity = { email: uniqueEmail('unverified'), emailVerified: false, name: null };
    const done = await callback(google.lastRequest!.state, binding);
    expect(done.headers.location).toBe(`${WEB}/signin?error=google_unverified`);
  });

  it('works once per attempt', async () => {
    const { binding } = await start();
    google.identity = { email: uniqueEmail('once'), emailVerified: true, name: null };
    const state = google.lastRequest!.state;
    expect((await callback(state, binding)).headers.location).toBe(`${WEB}/organiser`);
    expect((await callback(state, binding)).headers.location).toBe(`${WEB}/signin?error=google`);
  });

  it('sends people back to sign-up when Google is not configured yet', async () => {
    google.configured = false;
    const { location } = await start();
    expect(location).toBe(`${WEB}/signin?error=google_unavailable`);
  });

  it('only redirects to relative paths after sign-in', () => {
    expect(safeReturnTo('/organiser/events')).toBe('/organiser/events');
    expect(safeReturnTo('https://evil.example')).toBe('/organiser');
    expect(safeReturnTo('//evil.example')).toBe('/organiser');
    expect(safeReturnTo('/\\evil.example')).toBe('/organiser');
    expect(safeReturnTo(undefined)).toBe('/organiser');
  });
});
