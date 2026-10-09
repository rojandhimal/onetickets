import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import {
  magicLinkRequest,
  magicLinkVerify,
  mfaCode,
  type MagicLinkRequest,
  type MagicLinkVerify,
  type MfaCode,
  type RecoveryCodes,
  type Session,
  type TotpSetup,
} from '@onetickets/shared';
import { parseCookie } from 'cookie';
import type { Response } from 'express';
import { Public, SignedIn } from './access.js';
import {
  AUTH_CONFIG,
  type AuthConfig,
  SESSION_ABSOLUTE_MS,
  sessionCookieName,
} from './auth.config.js';
import type { AppRequest } from './auth-context.js';
import { AuthService } from './auth.service.js';
import { invalidField, notSignedIn } from './errors.js';
import { GoogleSignInService } from './google-sign-in.service.js';
import { MfaService } from './mfa.service.js';
import { sessionToken } from './session.middleware.js';
import { ZodBody } from './zod-body.pipe.js';

@Controller()
export class AuthController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly google: GoogleSignInService,
  ) {}

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(sessionCookieName(this.config), token, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_ABSOLUTE_MS,
    });
  }

  /** Signs in on this browser, revoking any session it already had so none is left orphaned. */
  private async startSession(request: AppRequest, response: Response, token: string) {
    const previous = sessionToken(request, this.config);
    if (previous) await this.auth.signOut(previous);
    this.setSessionCookie(response, token);
  }

  private get oauthCookie(): string {
    return this.config.secureCookies ? '__Host-ot_oauth' : 'ot_oauth';
  }

  @Get('auth/google/start')
  @Public()
  async googleStart(
    @Res() response: Response,
    @Query('organiserName') organiserName: unknown,
    @Query('returnTo') returnTo: unknown,
  ): Promise<void> {
    const start = await this.google.start(organiserName, returnTo);
    if (start.ok) {
      response.cookie(this.oauthCookie, start.bindingToken, {
        httpOnly: true,
        secure: this.config.secureCookies,
        // Lax lets the cookie ride Google's top-level redirect back to the callback.
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60_000,
      });
    }
    response.redirect(302, start.redirect);
  }

  @Get('auth/google/callback')
  @Public()
  async googleCallback(@Req() request: AppRequest, @Res() response: Response): Promise<void> {
    const binding = request.headers.cookie
      ? parseCookie(request.headers.cookie)[this.oauthCookie]
      : undefined;
    const finish = await this.google.finish(this.google.callbackUrl(request.originalUrl), binding);
    response.clearCookie(this.oauthCookie, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
    });
    if (finish.ok) await this.startSession(request, response, finish.sessionToken);
    response.redirect(302, finish.redirect);
  }

  @Post('auth/magic-link')
  @HttpCode(202)
  @Public()
  async requestMagicLink(
    @Req() request: AppRequest,
    @Body(new ZodBody(magicLinkRequest)) body: MagicLinkRequest,
  ): Promise<void> {
    await this.auth.requestMagicLink(body.email, body.organiserName ?? null, clientIp(request));
  }

  @Post('auth/magic-link/verify')
  @HttpCode(200)
  @Public()
  async verifyMagicLink(
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodBody(magicLinkVerify)) body: MagicLinkVerify,
  ): Promise<Session> {
    const { sessionToken, session } = await this.auth.verifyMagicLink(
      body.token,
      clientIp(request),
    );
    await this.startSession(request, response, sessionToken);
    return session;
  }

  @Get('me')
  @SignedIn()
  async me(@Req() request: AppRequest): Promise<Session> {
    return this.auth.me(signedIn(request));
  }

  @Post('me/mfa/totp/setup')
  @HttpCode(200)
  @SignedIn()
  async setupTotp(@Req() request: AppRequest): Promise<TotpSetup> {
    return this.mfa.setup(signedIn(request).userId);
  }

  @Post('me/mfa/totp/confirm')
  @HttpCode(200)
  @SignedIn()
  async confirmTotp(
    @Req() request: AppRequest,
    @Body(new ZodBody(mfaCode)) body: MfaCode,
  ): Promise<RecoveryCodes> {
    if (!('code' in body)) throw invalidField('code');
    const codes = await this.mfa.confirm(signedIn(request).userId, body.code);
    await this.auth.markMfaVerified(sessionToken(request, this.config)!);
    return codes;
  }

  @Post('auth/mfa/verify')
  @HttpCode(204)
  @SignedIn()
  async verifyMfa(
    @Req() request: AppRequest,
    @Body(new ZodBody(mfaCode)) body: MfaCode,
  ): Promise<void> {
    await this.mfa.verify(signedIn(request).userId, body);
    await this.auth.markMfaVerified(sessionToken(request, this.config)!);
  }

  @Post('auth/sign-out')
  @HttpCode(204)
  @Public()
  async signOut(
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = sessionToken(request, this.config);
    if (token) await this.auth.signOut(token);
    response.clearCookie(sessionCookieName(this.config), {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
    });
  }
}

function signedIn(request: AppRequest) {
  if (!request.auth) throw notSignedIn();
  return request.auth;
}

/** The caller's IP. Behind Cloudflare and the web rewrite, `trust proxy` makes this real. */
function clientIp(request: AppRequest): string {
  return request.ip ?? 'unknown';
}
