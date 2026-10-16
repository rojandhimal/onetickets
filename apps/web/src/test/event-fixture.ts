import type { EventDraftDto, TicketTypeDto } from '@onetickets/shared';

export const generalAdmission: TicketTypeDto = {
  id: 'tt_1',
  name: 'General admission',
  capacity: 40,
  maxPerOrder: 10,
  priceCents: 0,
  salesStart: { kind: 'on_publish' },
  salesEnd: { kind: 'event_start' },
  sold: 0,
};

/** A fresh Workshop draft as the api returns it after POST /organisations/:id/events. */
export function draftEvent(overrides: Partial<EventDraftDto> = {}): EventDraftDto {
  return {
    id: 'evt_1',
    organisationId: 'org_1',
    status: 'draft',
    version: 1,
    template: 'workshop',
    name: null,
    startsAt: null,
    endsAt: null,
    timeZone: 'Australia/Sydney',
    venue: null,
    about: '',
    accessibility: { features: [], notes: '' },
    cancellationPolicy: 'any_time',
    contactEmail: null,
    banner: null,
    lastStep: 'basics',
    ticketTypes: [generalAdmission],
    slug: null,
    publishedAt: null,
    updatedAt: '2026-10-10T00:00:00Z',
    ...overrides,
  };
}

/** The same draft with everything publishing needs. */
export function readyEvent(overrides: Partial<EventDraftDto> = {}): EventDraftDto {
  return draftEvent({
    name: 'Screen printing for beginners',
    startsAt: '2026-11-14T10:00:00+11:00',
    endsAt: '2026-11-14T13:00:00+11:00',
    venue: {
      kind: 'place',
      placeId: 'pl_1',
      name: 'The Print Shed',
      address: '12 Sydenham Rd, Marrickville NSW 2204',
      suburb: 'Marrickville',
      city: 'sydney',
      lat: -33.91,
      lng: 151.16,
    },
    ...overrides,
  });
}
