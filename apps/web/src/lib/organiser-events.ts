import type { EventDraftDto } from '@onetickets/shared';
import { stepHref } from './wizard-model';
import { eventEyebrow } from './zoned-time';

// The organiser home's Upcoming and Drafts segments (design artboard 6, S1 scope).

export type EventsView = 'upcoming' | 'drafts';

export interface EventCard {
  id: string;
  title: string;
  when: string;
  status: 'live' | 'draft';
  /** Published events only: booked so far against the total across ticket types. */
  sold: { sold: number; capacity: number } | null;
  action: { label: string; href: string };
}

export function splitEvents(events: EventDraftDto[], now = new Date()) {
  const upcoming = events
    .filter((e) => e.status === 'published' && new Date(e.endsAt ?? e.startsAt ?? 0) >= now)
    .sort((a, b) => Date.parse(a.startsAt ?? '') - Date.parse(b.startsAt ?? ''));
  const drafts = events
    .filter((e) => e.status === 'draft')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return { upcoming, drafts };
}

/** The segment to open: the one asked for, else Upcoming unless only drafts exist. */
export function pickView(
  asked: string | undefined,
  counts: { upcoming: number; drafts: number },
): EventsView {
  if (asked === 'upcoming' || asked === 'drafts') return asked;
  return counts.upcoming === 0 && counts.drafts > 0 ? 'drafts' : 'upcoming';
}

export function eventCard(event: EventDraftDto): EventCard {
  const live = event.status === 'published';
  const capacity = event.ticketTypes.reduce((n, t) => n + t.capacity, 0);
  const sold = event.ticketTypes.reduce((n, t) => n + t.sold, 0);
  return {
    id: event.id,
    title: event.name?.trim() || 'Untitled event',
    when: event.startsAt ? eventEyebrow(event.startsAt, event.timeZone) : 'Date to come',
    status: live ? 'live' : 'draft',
    sold: live ? { sold, capacity } : null,
    action:
      live && event.slug
        ? { label: 'Open event page', href: `/e/${event.slug}` }
        : { label: 'Finish setting up', href: stepHref(event.lastStep, event.id) },
  };
}
