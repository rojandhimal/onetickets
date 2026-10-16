import 'server-only';
import { cache } from 'react';
import type { PublicEventDto } from '@onetickets/shared';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

/** How long a public event read is reused before Next fetches it again. */
export const PUBLIC_EVENT_TTL_S = 60;

/** Cache tags the api's revalidate call clears (see app/internal/revalidate). */
export const eventTag = (slug: string) => `event:${slug}`;
export const BROWSE_TAG = 'browse';

/**
 * A published event by its slug, or null when there's no such event. Kept in Next's data cache for
 * a minute under the event's tag, so a published edit shows up as soon as the api calls
 * /internal/revalidate. React's cache() also shares one read between the page, its metadata and
 * its share image within a request.
 */
export const getPublicEvent = cache(async (slug: string): Promise<PublicEventDto | null> => {
  const res = await fetch(`${apiUrl}/public/events/${encodeURIComponent(slug)}`, {
    next: { revalidate: PUBLIC_EVENT_TTL_S, tags: [eventTag(slug)] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /public/events/:slug failed with ${res.status}`);
  return (await res.json()) as PublicEventDto;
});
