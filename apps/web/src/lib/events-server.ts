import 'server-only';
import { cookies } from 'next/headers';
import type { EventDraftDto, EventListDto } from '@onetickets/shared';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

/** One of the organiser's event drafts, or null when it doesn't exist or isn't theirs. */
export async function getEventDraft(
  organisationId: string,
  id: string,
): Promise<EventDraftDto | null> {
  const cookieHeader = (await cookies()).toString();
  const path = `/organisations/${encodeURIComponent(organisationId)}/events/${encodeURIComponent(id)}`;
  const res = await fetch(`${apiUrl}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: 'no-store',
  });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GET event draft failed with ${res.status}`);
  return (await res.json()) as EventDraftDto;
}

/** The organisation's events, drafts and published. Null when the api refuses the list. */
export async function listEvents(organisationId: string): Promise<EventDraftDto[] | null> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${apiUrl}/organisations/${encodeURIComponent(organisationId)}/events`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: 'no-store',
  });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GET events failed with ${res.status}`);
  return ((await res.json()) as EventListDto).items;
}
