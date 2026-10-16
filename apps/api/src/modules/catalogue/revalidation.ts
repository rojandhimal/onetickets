import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Logger } from '@nestjs/common';

/**
 * Tells the web app that a live event's public page changed, so it can drop what it has cached
 * (the event page, its link preview, browse) instead of serving it until the cache expires.
 * Called after the change is committed. It never fails the organiser's request: a missed signal
 * only means the old page lasts until its short cache time runs out.
 */
export abstract class PublicPageRevalidator {
  abstract changed(slug: string): void;
}

/** Revalidation is off (local development and tests without a web app to tell). */
export class NoRevalidation extends PublicPageRevalidator {
  changed(): void {}
}

/** Every address a hostname resolves to (Cloud Map returns one A record per web task). */
export type ResolveAll = (hostname: string) => Promise<string[]>;

const resolveAll: ResolveAll = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address);

/**
 * POSTs `{ slugs }` to the web app's revalidate route, authenticated with a shared secret. A slug
 * is set once, at publish, and never changes, so there is never an old slug to send too.
 *
 * Each web task keeps its own data cache, so over plain HTTP (the private address) the call goes
 * to every address the hostname resolves to, in parallel and within one timeout. Over HTTPS (the
 * public WEB_URL fallback) the certificate names the host, so it goes once through the load
 * balancer and the other tasks catch up within the cache's minute.
 */
export class WebRevalidator extends PublicPageRevalidator {
  private readonly logger = new Logger(WebRevalidator.name);

  constructor(
    private readonly endpoint: URL,
    private readonly secret: string,
    private readonly timeoutMs = 2000,
    private readonly resolve: ResolveAll = resolveAll,
  ) {
    super();
  }

  changed(slug: string): void {
    void this.send(slug);
  }

  /** Resolves once every web task answered or failed, true if all of them took it; never rejects. */
  async send(slug: string): Promise<boolean> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    const targets = await this.targets();
    const results = await Promise.all(targets.map((target) => this.post(target, slug, signal)));
    return results.every(Boolean);
  }

  private async targets(): Promise<URL[]> {
    const { hostname, protocol } = this.endpoint;
    if (protocol !== 'http:' || isIP(hostname)) return [this.endpoint];
    try {
      const addresses = await this.resolve(hostname);
      if (addresses.length === 0) return [this.endpoint];
      return addresses.map((address) => {
        const target = new URL(this.endpoint);
        target.hostname = isIP(address) === 6 ? `[${address}]` : address;
        return target;
      });
    } catch {
      return [this.endpoint];
    }
  }

  private async post(target: URL, slug: string, signal: AbortSignal): Promise<boolean> {
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ slugs: [slug] }),
        signal,
      });
      if (!response.ok) {
        this.logger.warn(
          `Revalidating /e/${slug} at ${target.host} failed with HTTP ${response.status}`,
        );
      }
      return response.ok;
    } catch (error) {
      this.logger.warn(
        `Revalidating /e/${slug} at ${target.host} failed: ${(error as Error).name}`,
      );
      return false;
    }
  }
}

export function revalidatorFromEnv(env: NodeJS.ProcessEnv = process.env): PublicPageRevalidator {
  const secret = env.REVALIDATE_SECRET;
  if (!secret) return new NoRevalidation();
  if (secret.length < 32) throw new Error('REVALIDATE_SECRET must be at least 32 characters');
  // The web app's private address (service discovery in AWS, `web` in compose), so the call
  // doesn't go out through Cloudflare and back. The public WEB_URL is only the fallback.
  const base = env.WEB_INTERNAL_URL || env.WEB_URL;
  if (!base) throw new Error('WEB_INTERNAL_URL or WEB_URL must be set');
  return new WebRevalidator(new URL('/internal/revalidate', base), secret);
}
