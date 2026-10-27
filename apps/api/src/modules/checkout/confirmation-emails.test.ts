import { randomUUID } from 'node:crypto';
import type { OrderTicketsDto } from '@onetickets/shared';
import { describe, expect, it } from 'vitest';
import { confirmationEmail } from './confirmation-emails.js';
import { newTicketKey } from './secrets.js';

const order: OrderTicketsDto = {
  orderId: randomUUID(),
  email: 'buyer@example.test',
  event: {
    slug: 'night',
    name: 'Community night\r\nBcc: attacker@example.test',
    startsAt: '2026-11-13T13:30:00Z',
    endsAt: '2026-11-13T15:00:00Z',
    timeZone: 'Australia/Sydney',
    organiser: { name: 'Example Host' },
    venue: { kind: 'online' },
  },
  tickets: [],
};
describe('ticket confirmation copy', () => {
  it('uses the event timezone, one-line headers and a fragment-only ticket credential', () => {
    const key = newTicketKey();
    const message = confirmationEmail(
      order,
      key,
      'https://tickets.example.test',
      'host@example.test',
      'up_to_24h',
      { kind: 'online', url: 'https://meet.example.test/room' },
    );
    expect(message.subject).toContain('Sat, 14 Nov');
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.text).toContain('12:30 am AEDT');
    expect(message.text).toContain('Cancel up to 24 hours before');
    expect(message.text).toContain(`/tickets/${order.orderId}#key=${key}`);
    expect(message.text).not.toContain('/my-tickets');
    expect(message.text).not.toContain('attached PDF');
  });
  it.each([
    ['any_time', 'Cancel any time.'],
    ['none', 'No cancellations.'],
  ] as const)('renders the %s cancellation policy and a physical venue', (policy, copy) => {
    const message = confirmationEmail(
      order,
      newTicketKey(),
      'https://tickets.example.test',
      'host@example.test',
      policy,
      {
        kind: 'place',
        placeId: 'example',
        name: 'Example Hall',
        address: '1 Example Street',
        suburb: 'Sydney',
        city: 'sydney',
        lat: -33,
        lng: 151,
      },
    );
    expect(message.text).toContain(copy);
    expect(message.text).toContain('Example Hall, 1 Example Street');
  });
});
