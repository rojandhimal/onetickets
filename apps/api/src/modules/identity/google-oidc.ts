import { Injectable } from '@nestjs/common';
import * as oidc from 'openid-client';

export interface GoogleAuthRequest {
  redirectUri: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** The Google OpenID Connect calls, behind an interface so tests can stand in for Google. */
export abstract class GoogleOidc {
  abstract readonly configured: boolean;
  abstract authorizationUrl(request: GoogleAuthRequest): Promise<URL>;
  /** Exchanges the code (with PKCE) and verifies the ID token: issuer, audience, expiry, nonce. */
  abstract exchange(callbackUrl: URL, request: GoogleAuthRequest): Promise<GoogleIdentity>;
}

/** Real Google, enabled when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */
@Injectable()
export class OpenIdGoogleOidc extends GoogleOidc {
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private config?: Promise<oidc.Configuration>;

  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private configuration(): Promise<oidc.Configuration> {
    this.config ??= oidc.discovery(
      new URL('https://accounts.google.com'),
      this.clientId!,
      this.clientSecret!,
    );
    return this.config;
  }

  async authorizationUrl(request: GoogleAuthRequest): Promise<URL> {
    return oidc.buildAuthorizationUrl(await this.configuration(), {
      redirect_uri: request.redirectUri,
      scope: 'openid email profile',
      state: request.state,
      nonce: request.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(request.codeVerifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  }

  async exchange(callbackUrl: URL, request: GoogleAuthRequest): Promise<GoogleIdentity> {
    const tokens = await oidc.authorizationCodeGrant(await this.configuration(), callbackUrl, {
      pkceCodeVerifier: request.codeVerifier,
      expectedState: request.state,
      expectedNonce: request.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || typeof claims.email !== 'string') throw new Error('Google sent no email');
    return {
      email: claims.email.toLowerCase(),
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name.slice(0, 200) : null,
    };
  }
}
