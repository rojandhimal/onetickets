import type { EventDraftDto, PublicEventDto, TicketTypeDto } from '@onetickets/shared';

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

/** A published Workshop as GET /public/events/:slug returns it. */
export function publicEvent(overrides: Partial<PublicEventDto> = {}): PublicEventDto {
  return {
    slug: 'screen-printing',
    name: 'Screen printing for beginners',
    startsAt: '2026-11-14T10:00:00+11:00',
    endsAt: '2026-11-14T13:00:00+11:00',
    timeZone: 'Australia/Sydney',
    template: 'workshop',
    organiser: { name: 'The Print Shed' },
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
    about: 'Print a two-colour design onto a tote bag.\nAll inks supplied.',
    accessibility: {
      features: ['step_free_access', 'accessible_toilet', 'seating_available'],
      notes: 'Ramp entry from the laneway.',
    },
    cancellationPolicy: 'any_time',
    hasContactEmail: true,
    banner: {
      url: '/api/public/banners/b1.webp',
      width: 2160,
      height: 1080,
      focus: { x: 0.5, y: 0.25 },
    },
    priceFromAllInCents: 0,
    spotsLeft: 18,
    ticketTypes: [
      {
        id: 'tt_1',
        name: 'General admission',
        allInPriceCents: 0,
        spotsLeft: 18,
        onSale: true,
        maxPerOrder: 10,
      },
    ],
    ...overrides,
  };
}
