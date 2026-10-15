import { describe, expect, expectTypeOf, it } from 'vitest';
import '../zod-config.js';
import {
  browseQuery,
  eventDraftPatch,
  ticketTypeInput,
  venueInput,
  type BrowseCardDto,
  type PublicEventDto,
} from './events.js';

const ticket = {
  name: 'General admission',
  capacity: 40,
  maxPerOrder: 10,
  priceCents: 0,
  salesStart: { kind: 'on_publish' },
  salesEnd: { kind: 'event_start' },
} as const;

describe('events contract', () => {
  it('caps a ticket price at A$10,000 in whole cents', () => {
    expect(ticketTypeInput.safeParse({ ...ticket, priceCents: 1_000_000 }).success).toBe(true);
    expect(ticketTypeInput.safeParse({ ...ticket, priceCents: 1_000_001 }).success).toBe(false);
    expect(ticketTypeInput.safeParse({ ...ticket, priceCents: 2 ** 31 }).success).toBe(false);
    expect(ticketTypeInput.safeParse({ ...ticket, priceCents: 9.5 }).success).toBe(false);
  });

  it('needs only a version to autosave', () => {
    expect(eventDraftPatch.parse({ version: 3 })).toEqual({ version: 3 });
    expect(eventDraftPatch.safeParse({ name: 'Pottery night' }).success).toBe(false);
  });

  it('refuses an end before the start, whatever the offsets', () => {
    // 18:30 Sydney is 07:30 UTC: before the start, although the string sorts after it.
    const result = eventDraftPatch.safeParse({
      version: 0,
      startsAt: '2026-11-14T08:00:00Z',
      endsAt: '2026-11-14T18:30:00+11:00',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('ends_before_start');
  });

  it('accepts an end after the start across offsets', () => {
    expect(
      eventDraftPatch.safeParse({
        version: 0,
        startsAt: '2026-11-14T19:00:00+11:00',
        endsAt: '2026-11-14T09:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('only allows https links for online events', () => {
    expect(venueInput.safeParse({ kind: 'online', url: 'https://meet.example/x' }).success).toBe(
      true,
    );
    expect(venueInput.safeParse({ kind: 'online', url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(venueInput.safeParse({ kind: 'online', url: 'http://meet.example/x' }).success).toBe(
      false,
    );
  });

  it('keeps max per order within capacity', () => {
    expect(ticketTypeInput.safeParse(ticket).success).toBe(true);
    const result = ticketTypeInput.safeParse({ ...ticket, capacity: 5 });
    expect(result.error?.issues[0]?.message).toBe('max_per_order_over_capacity');
  });

  it('keeps a fixed sales end after a fixed sales start', () => {
    const result = ticketTypeInput.safeParse({
      ...ticket,
      salesStart: { kind: 'at', at: '2026-11-01T09:00:00+11:00' },
      salesEnd: { kind: 'at', at: '2026-10-31T21:00:00Z' },
    });
    expect(result.error?.issues[0]?.message).toBe('sales_end_before_start');
  });

  it('defaults browse to Sydney, 20 at a time', () => {
    expect(browseQuery.parse({})).toEqual({ city: 'sydney', limit: 20 });
    expect(browseQuery.parse({ limit: '5', when: 'tonight' })).toMatchObject({ limit: 5 });
  });

  it('keeps private details out of the public types (checked by typecheck)', () => {
    expectTypeOf<PublicEventDto>().not.toHaveProperty('contactEmail');
    expectTypeOf<PublicEventDto>().not.toHaveProperty('organisationId');
    expectTypeOf<PublicEventDto['venue']>().toEqualTypeOf<
      Exclude<PublicEventDto['venue'], { kind: 'online'; url: string }>
    >();
    expectTypeOf<Extract<PublicEventDto['venue'], { kind: 'online' }>>().not.toHaveProperty('url');
    expectTypeOf<BrowseCardDto>().not.toHaveProperty('contactEmail');
  });

  it('lets autosave clear fields with null', () => {
    expect(
      eventDraftPatch.parse({ version: 1, name: null, startsAt: null, endsAt: null }),
    ).toMatchObject({ name: null, startsAt: null, endsAt: null });
  });
});
