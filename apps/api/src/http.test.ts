import 'reflect-metadata';
import { Controller, Get, Module, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { configureTrustProxy } from './http.js';

@Controller()
class IpController {
  @Get('ip')
  ip(@Req() req: Request): string {
    return req.ip ?? '';
  }
}

@Module({ controllers: [IpController] })
class IpModule {}

async function ipSeen(hops: string | undefined, forwardedFor: string): Promise<string> {
  const app = await NestFactory.create<NestExpressApplication>(IpModule, { logger: false });
  configureTrustProxy(app, { TRUST_PROXY_HOPS: hops });
  await app.init();
  try {
    const res = await request(app.getHttpServer()).get('/ip').set('x-forwarded-for', forwardedFor);
    return res.text;
  } finally {
    await app.close();
  }
}

// The web app's /api rewrite forwards X-Forwarded-For unchanged, so with nothing appending in
// front (local dev, CI) a client-supplied header must not decide request.ip.
describe('configureTrustProxy', () => {
  it('ignores X-Forwarded-For when no proxy appends to it', async () => {
    expect(await ipSeen('0', '203.0.113.77')).not.toBe('203.0.113.77');
  });

  it('defaults to trusting nothing', async () => {
    expect(await ipSeen(undefined, '203.0.113.77')).not.toBe('203.0.113.77');
  });

  it('takes the address the load balancer appended, not one the client prepended', async () => {
    expect(await ipSeen('1', '203.0.113.77, 198.51.100.7')).toBe('198.51.100.7');
  });

  it('refuses a count that is not a whole number', async () => {
    await expect(ipSeen('true', '203.0.113.77')).rejects.toThrow('TRUST_PROXY_HOPS');
  });
});
