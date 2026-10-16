import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

/**
 * How many proxies in front of the api append the client address to X-Forwarded-For, so
 * `request.ip` (and with it the per-IP rate limits) is the real client. In AWS the load balancer
 * appends: 1, or 2 once Cloudflare is in front too. The web app's /api rewrite forwards the
 * header unchanged and does not count, so locally, with nothing appending, it is 0. Never
 * `true`, and never more than the real count: either would let a client choose its own IP.
 */
export function configureTrustProxy(
  app: NestExpressApplication,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const hops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a whole number of proxies (0 locally)');
  }
  app.set('trust proxy', hops);
}

/** Nest's own logs (and every `new Logger(...)` in the modules) go through pino and its redactor. */
export function configureLogging(app: NestExpressApplication): void {
  app.useLogger(app.get(Logger));
}

/**
 * Nothing the api sends may be kept by a browser or a shared cache unless its route says so.
 * Most responses are private to a signed-in organiser, and a CDN in front (Cloudflare) must never
 * store one. The public event routes override this, only on success, with `PUBLIC_CACHE`.
 */
export function noStoreByDefault(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('cache-control', 'no-store');
  next();
}

/**
 * Public event pages and browse: shared caches may keep them for a minute and serve a stale copy
 * for five more while refetching. Browsers always revalidate. Publishing or editing a live event
 * tells the web app to drop its copy straight away (see revalidation.ts), so the minute only
 * bounds how stale spots left can be.
 */
export const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
