import type { NestExpressApplication } from '@nestjs/platform-express';

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
