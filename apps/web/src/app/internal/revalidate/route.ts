import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { BROWSE_TAG, eventTag } from '@/lib/public-events';

// The api calls this on its private address after it publishes an event or commits a change to a
// live one, so the event page and browse stop serving the cached copy. Without the secret set
// (local dev, tests) the route is off.

const SLUG = /^[a-z0-9-]{1,120}$/;
const MAX_SLUGS = 50;

function authorised(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual needs equal lengths; comparing against itself keeps the time the same.
  if (given.length !== expected.length) {
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(given, expected);
}

function parseSlugs(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const slugs = (body as { slugs?: unknown }).slugs;
  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > MAX_SLUGS) return null;
  if (!slugs.every((s): s is string => typeof s === 'string' && SLUG.test(s))) return null;
  return slugs;
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  if (!authorised(request.headers.get('authorization'), secret)) {
    return new Response(null, { status: 401 });
  }

  let slugs: string[] | null;
  try {
    slugs = parseSlugs(await request.json());
  } catch {
    slugs = null;
  }
  if (!slugs) return new Response(null, { status: 400 });

  // expire: 0 drops the entries now, so the next visitor gets the edit rather than a stale copy.
  for (const slug of slugs) revalidateTag(eventTag(slug), { expire: 0 });
  revalidateTag(BROWSE_TAG, { expire: 0 });
  return new Response(null, { status: 204 });
}
