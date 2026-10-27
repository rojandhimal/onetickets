import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  attendeeLinkRequest,
  attendeeLinkVerify,
  type AttendeeLinkRequest,
  type AttendeeLinkVerify,
  type AttendeeSession,
} from '@onetickets/shared';
import type { Response } from 'express';
import { Public } from './access.js';
import { AttendeeAuthService, attendeeCookieName } from './attendee-auth.service.js';
import { AUTH_CONFIG, type AuthConfig, SESSION_ABSOLUTE_MS } from './auth.config.js';
import type { AppRequest } from './auth-context.js';
import { ZodBody } from './zod-body.pipe.js';

@Controller('attendee')
export class AttendeeAuthController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly auth: AttendeeAuthService,
  ) {}

  @Post('magic-link')
  @HttpCode(202)
  @Public()
  async requestLink(
    @Req() request: AppRequest,
    @Body(new ZodBody(attendeeLinkRequest)) body: AttendeeLinkRequest,
  ): Promise<void> {
    await this.auth.requestLink(body.email, request.ip ?? 'unknown', body.turnstileToken);
  }

  @Post('magic-link/verify')
  @HttpCode(200)
  @Public()
  async verifyLink(
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodBody(attendeeLinkVerify)) body: AttendeeLinkVerify,
  ): Promise<AttendeeSession> {
    const { token, session } = await this.auth.verifyLink(body.token, request);
    response.cookie(attendeeCookieName(this.config), token, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_ABSOLUTE_MS,
    });
    return session;
  }

  @Get('session')
  @Public()
  async session(@Req() request: AppRequest): Promise<AttendeeSession> {
    return this.auth.requireSession(request);
  }

  @Post('sign-out')
  @HttpCode(204)
  @Public()
  async signOut(
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.signOut(request);
    response.clearCookie(attendeeCookieName(this.config), {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
    });
    response.setHeader('Clear-Site-Data', '"storage"');
  }
}
