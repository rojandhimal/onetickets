import { describe, expect, it } from 'vitest';
import {
  BROWSE_EMPTY,
  BROWSE_NOTE,
  browseHeading,
  browseHref,
  browseQueryString,
  cardAriaLabel,
  cardPriceLabel,
  cardVenueLabel,
  parseBrowseFilters,
  resultCountStatus,
  toggleFilter,
} from './browse';

describe('browse helpers', () => {
  it('parses valid query parameters and falls back to sydney when missing or unknown', () => {
    expect(parseBrowseFilters()).toEqual({ city: 'sydney' });
    expect(parseBrowseFilters({ city: 'brisbane', when: 'later', price: 'cheap' })).toEqual({
      city: 'sydney',
    });
    expect(
      parseBrowseFilters({
        city: ['melbourne', 'sydney'],
        when: 'this_weekend',
        price: 'free',
      }),
    ).toEqual({
      city: 'melbourne',
      when: 'this_weekend',
      price: 'free',
    });
  });

  it('toggles single-select filters and clears when tapped again', () => {
    expect(toggleFilter(undefined, 'tonight')).toBe('tonight');
    expect(toggleFilter('tonight', 'this_weekend')).toBe('this_weekend');
    expect(toggleFilter('tonight', 'tonight')).toBeUndefined();
  });

  it('builds api query strings and clean browser hrefs', () => {
    expect(browseQueryString({ city: 'sydney' })).toBe('city=sydney');
    expect(browseQueryString({ city: 'melbourne', when: 'next_7_days', price: 'paid' })).toBe(
      'city=melbourne&when=next_7_days&price=paid',
    );

    expect(browseHref({ city: 'sydney' })).toBe('/');
    expect(browseHref({ city: 'sydney', when: 'tonight' })).toBe('/?when=tonight');
    expect(browseHref({ city: 'melbourne', price: 'free' })).toBe('/?city=melbourne&price=free');
  });

  it('matches the heading and status copy from the copy deck', () => {
    expect(browseHeading()).toBe('Coming up near you');
    expect(browseHeading('tonight')).toBe('On tonight');
    expect(browseHeading('this_weekend')).toBe('This weekend');
    expect(browseHeading('next_7_days')).toBe('Next 7 days');
    expect(BROWSE_NOTE).toBe('Prices shown are what you pay. No fees added later.');
    expect(BROWSE_EMPTY).toBe('Nothing on for that yet. Try Next 7 days.');
    expect(resultCountStatus(0)).toBe('0 events');
    expect(resultCountStatus(1)).toBe('1 event');
    expect(resultCountStatus(4)).toBe('4 events');
  });

  it('formats the card price from the api all-in cents without recomputing fees', () => {
    expect(cardPriceLabel(0)).toBe('Free');
    expect(cardPriceLabel(5335)).toBe('From A$53.35 all-in');
    expect(cardPriceLabel(2500)).toBe('From A$25.00 all-in');
  });

  it('formats the venue line and full four-fact aria-label for cards', () => {
    expect(
      cardVenueLabel({ online: false, suburb: 'Marrickville', venueName: 'The Print Shed' }),
    ).toBe('Marrickville · The Print Shed');
    expect(cardVenueLabel({ online: true, suburb: null, venueName: null })).toBe('Online');

    expect(
      cardAriaLabel({
        name: 'Screen printing for beginners',
        startsAt: '2026-11-14T10:00:00+11:00',
        timeZone: 'Australia/Sydney',
        online: false,
        suburb: 'Marrickville',
        venueName: 'The Print Shed',
        priceFromAllInCents: 0,
      }),
    ).toBe(
      'Screen printing for beginners, Sat 14 Nov · 10:00 am, Marrickville · The Print Shed, Free',
    );
  });
});
