import type { OrderTicketsDto, TicketDto } from '@/lib/tickets';

const ticket = (overrides: Partial<TicketDto> = {}): TicketDto => ({
  id: '7d1b3c1e-0000-4000-8000-000000000001',
  ref: '7K4Q-2M9X',
  holderName: 'Jordan Lee',
  ticketTypeName: 'General admission',
  qr: 'OT1.k1.evt_1.tkt_1.1792677665.c2lnbmF0dXJl',
  status: 'valid',
  ...overrides,
});

/** A fake order of free tickets for "Screen printing for beginners" (fake people, example.test). */
export function orderFixture(overrides: Partial<OrderTicketsDto> = {}): OrderTicketsDto {
  return {
    orderId: 'ord_1',
    email: 'jordan@example.test',
    event: {
      slug: 'screen-printing-k7q4',
      name: 'Screen printing for beginners',
      startsAt: '2026-11-14T10:00:00+11:00',
      endsAt: '2026-11-14T13:00:00+11:00',
      timeZone: 'Australia/Sydney',
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
      organiser: { name: 'Marrickville Print Club' },
    },
    tickets: [
      ticket(),
      ticket({
        id: '7d1b3c1e-0000-4000-8000-000000000002',
        ref: '7K4Q-5TQ3',
        holderName: 'Sam Lee',
        qr: 'OT1.k1.evt_1.tkt_2.1792677665.c2lnbmF0dXJl',
      }),
    ],
    ...overrides,
  };
}

export { ticket as ticketFixture };
