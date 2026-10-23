import { describe, expect, it } from 'vitest';
import {
  accessibilitySummary,
  initials,
  mapsHref,
  priceLabel,
  priceNote,
  spotsLine,
} from './event-page';

describe('event page wording', () => {
  it('prices and spots', () => {
    expect(priceLabel(0)).toBe('Free');
    expect(priceLabel(5335)).toBe('A$53.35');
    expect(spotsLine({ spotsLeft: 18, soldOut: false })).toBe('18 spots left');
    expect(spotsLine({ spotsLeft: 1, soldOut: false })).toBe('1 spot left');
    expect(priceNote({ priceFromAllInCents: 0, spotsLeft: 18, soldOut: false })).toBe(
      'No booking fee. 18 spots left.',
    );
  });

  it('keeps held tickets apart from sold out (ARCH-2)', () => {
    const held = { priceFromAllInCents: 0, spotsLeft: 0, soldOut: false };
    expect(spotsLine(held)).toBe('All taken right now');
    expect(priceNote(held)).toBe('All taken right now. Check back in a few minutes.');
    const sold = { priceFromAllInCents: 0, spotsLeft: 0, soldOut: true };
    expect(spotsLine(sold)).toBe('All tickets taken');
    expect(priceNote(sold)).toBe('Sold out; spots that are released go back on sale here.');
  });

  it('summarises accessibility with the first feature first', () => {
    expect(
      accessibilitySummary({
        features: ['step_free_access', 'accessible_toilet', 'seating_available'],
        notes: '',
      }),
    ).toEqual({ lead: 'Step-free access', rest: ['Accessible toilet', 'Seating available'] });
    expect(accessibilitySummary({ features: [], notes: 'Ramp at the back' })).toEqual({
      lead: 'Access notes',
      rest: [],
    });
    expect(accessibilitySummary({ features: [], notes: '  ' })).toBeNull();
  });

  it('makes organiser initials', () => {
    expect(initials('The Print Shed')).toBe('PS');
    expect(initials('Marrickville Makers Collective')).toBe('MC');
    expect(initials('Priya')).toBe('P');
    expect(initials('   ')).toBe('?');
  });

  it('builds a maps link that escapes the venue text', () => {
    const href = mapsHref({
      name: 'Tom & Jo"s',
      address: '1 Main St',
      lat: -33.9,
      lng: 151.1,
    });
    expect(href).toBe(
      'https://www.google.com/maps/search/?api=1&query=Tom%20%26%20Jo%22s%2C%201%20Main%20St&center=-33.9,151.1',
    );
  });
});
