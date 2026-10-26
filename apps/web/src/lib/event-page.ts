import type { AccessibilityFeature, CancellationPolicy, PublicEventDto } from '@onetickets/shared';
import { formatAud } from '@onetickets/shared';

// Wording for the public event page (design 2, copy-s0-s2.md), kept apart from the markup for tests.

export const ACCESSIBILITY_LABELS: Record<AccessibilityFeature, string> = {
  step_free_access: 'Step-free access',
  accessible_toilet: 'Accessible toilet',
  hearing_loop: 'Hearing loop',
  seating_available: 'Seating available',
  auslan_interpreter: 'Auslan interpreter',
  quiet_space: 'Quiet space',
};

export const CANCELLATION_COPY: Record<CancellationPolicy, { title: string; detail: string }> = {
  any_time: { title: 'Cancel any time', detail: 'Release your ticket up to the start.' },
  up_to_24h: {
    title: 'Cancel up to 24 hours before',
    detail: 'Release your ticket up to 24 hours before the start.',
  },
  none: { title: 'No cancellations', detail: "Tickets can't be released once booked." },
};

export const TEMPLATE_WORDS: Record<PublicEventDto['template'], string> = {
  workshop: 'Workshop',
  gig: 'Gig',
  school_night: 'School night',
  meetup: 'Meetup',
  blank: 'Event',
};

/** "Free", or "A$53.35" for the all-in price. */
export function priceLabel(cents: number): string {
  return cents === 0 ? 'Free' : formatAud(cents);
}

type Availability = Pick<PublicEventDto, 'spotsLeft' | 'soldOut'>;

/**
 * The bar's short line. Sold out only when every ticket is sold; while checkout holds fill the
 * event, it's "right now", never sold out (ARCH-2).
 */
export function spotsLine({ spotsLeft, soldOut }: Availability): string {
  if (soldOut) return 'All tickets taken';
  if (spotsLeft <= 0) return 'All taken right now';
  return `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`;
}

/** The second line under Price in the key facts. */
export function priceNote(event: Pick<PublicEventDto, 'priceFromAllInCents'> & Availability) {
  if (event.soldOut) return 'Sold out; spots that are released go back on sale here.';
  if (event.spotsLeft <= 0) return 'All taken right now. Check back in a few minutes.';
  const fee = event.priceFromAllInCents === 0 ? 'No booking fee.' : 'Booking fee included.';
  return `${fee} ${spotsLine(event)}.`;
}

/** The key-facts row: the first feature in bold, the rest inline. Null when nothing is set. */
export function accessibilitySummary(
  accessibility: PublicEventDto['accessibility'],
): { lead: string; rest: string[] } | null {
  const labels = accessibility.features.map((f) => ACCESSIBILITY_LABELS[f]);
  const [lead, ...rest] = labels;
  if (lead) return { lead, rest };
  return accessibility.notes.trim() ? { lead: 'Access notes', rest: [] } : null;
}

/** Up to two initials for the organiser card, e.g. "The Print Shed" → "PS". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^(the|a|an|of|and|&)$/i.test(w));
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return picked.map((w) => w?.[0]?.toUpperCase() ?? '').join('') || '?';
}

/**
 * Opens the phone's maps app: Google Maps' universal link hands off to the installed app on
 * Android and iOS, and falls back to the web map.
 */
export function mapsHref(venue: { name: string; address: string; lat: number; lng: number }) {
  const query = `${venue.name}, ${venue.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&center=${venue.lat},${venue.lng}`;
}

/** og:description, e.g. "Sat 14 Nov · The Print Shed, Marrickville · Free". */
export function shareDescription(event: PublicEventDto, when: string): string {
  const where =
    event.venue.kind === 'online' ? 'Online' : `${event.venue.name}, ${event.venue.suburb}`;
  return [when, where, priceLabel(event.priceFromAllInCents)].join(' · ');
}
