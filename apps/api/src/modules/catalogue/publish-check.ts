import type { PublishRequirement } from '@onetickets/shared';

export interface PublishCandidate {
  name: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  hasVenue: boolean;
  ticketTypeCount: number;
  contactEmail: string | null;
}

/** What is still needed before an event can be published, in checklist order. */
export function missingForPublish(event: PublishCandidate, now: Date): PublishRequirement[] {
  const missing: PublishRequirement[] = [];
  if (!event.name) missing.push('name');
  if (!event.startsAt || !event.endsAt || event.endsAt <= event.startsAt || event.startsAt <= now) {
    missing.push('date_time');
  }
  if (!event.hasVenue) missing.push('venue');
  if (event.ticketTypeCount === 0) missing.push('ticket_type');
  if (!event.contactEmail?.trim()) missing.push('contact_email');
  return missing;
}

/** A readable, unguessable public address: the name in kebab case plus a random suffix. */
export function slugFor(name: string, suffix: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return base ? `${base}-${suffix}` : suffix;
}
