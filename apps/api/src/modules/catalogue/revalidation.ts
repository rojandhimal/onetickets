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

/**
 * POSTs `{ slugs }` to the web app's revalidate route, authenticated with a shared secret. A slug
 * is set once, at publish, and never changes, so there is never an old slug to send too.
 */
export class WebRevalidator extends PublicPageRevalidator {
  private readonly logger = new Logger(WebRevalidator.name);

  constructor(
    private readonly endpoint: URL,
    private readonly secret: string,
    private readonly timeoutMs = 2000,
  ) {
    super();
  }

  changed(slug: string): void {
    void this.send(slug);
  }

  /** Resolves once the web app answered or the attempt failed; never rejects. */
  async send(slug: string): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ slugs: [slug] }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        this.logger.warn(`Revalidating /e/${slug} failed with HTTP ${response.status}`);
      }
      return response.ok;
    } catch (error) {
      this.logger.warn(`Revalidating /e/${slug} failed: ${(error as Error).name}`);
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
