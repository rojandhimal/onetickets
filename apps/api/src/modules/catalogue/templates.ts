import type { EventTemplate, TicketTypeInput } from '@onetickets/shared';

/** Default ticket capacity for each template (design handoff S1-1). */
const CAPACITY: Record<EventTemplate, number> = {
  workshop: 40,
  gig: 100,
  school_night: 150,
  meetup: 30,
  blank: 100,
};

/** The ticket type a new event starts with: free general admission, on sale until it starts. */
export function starterTicketType(template: EventTemplate): TicketTypeInput {
  return {
    name: 'General admission',
    capacity: CAPACITY[template],
    maxPerOrder: 10,
    priceCents: 0,
    salesStart: { kind: 'on_publish' },
    salesEnd: { kind: 'event_start' },
  };
}
