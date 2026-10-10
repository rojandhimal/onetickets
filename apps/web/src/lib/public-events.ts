import 'server-only';
import { cache } from 'react';
import type { PublicEventDto } from '@onetickets/shared';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

/**
 * A published event by its slug, or null when there's no such event. Cached per request so the
 * page, its metadata and its share image don't each call the api.
 */
export const getPublicEvent = cache(async (slug: string): Promise<PublicEventDto | null> => {
  const res = await fetch(`${apiUrl}/public/events/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /public/events/:slug failed with ${res.status}`);
  return (await res.json()) as PublicEventDto;
});
