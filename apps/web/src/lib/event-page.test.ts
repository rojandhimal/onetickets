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
    expect(spotsLine(18)).toBe('18 spots left');
    expect(spotsLine(1)).toBe('1 spot left');
    expect(spotsLine(0)).toBe('All taken');
    expect(priceNote({ priceFromAllInCents: 0, spotsLeft: 18 })).toBe(
      'No booking fee. 18 spots left.',
    );
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
