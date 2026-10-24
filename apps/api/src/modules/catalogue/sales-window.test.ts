import { describe, expect, it } from 'vitest';
import { eventAvailability, onSale, salesEndsAt, windowIsValid } from './sales-window.js';

const event = {
  startsAt: new Date('2026-11-14T08:00:00Z'),
  endsAt: new Date('2026-11-14T11:00:00Z'),
  publishedAt: new Date('2026-11-01T00:00:00Z'),
};

describe('ticket sales windows', () => {
  it('resolves relative sales ends against the event', () => {
    expect(salesEndsAt({ kind: 'hour_before' }, event)?.toISOString()).toBe(
      '2026-11-14T07:00:00.000Z',
    );
    expect(salesEndsAt({ kind: 'day_before' }, event)?.toISOString()).toBe(
      '2026-11-13T08:00:00.000Z',
    );
    expect(salesEndsAt({ kind: 'event_end' }, event)).toEqual(event.endsAt);
    expect(salesEndsAt({ kind: 'event_start' }, { ...event, startsAt: null })).toBeNull();
  });

  it('is on sale from publishing until the sales end', () => {
    const start = { kind: 'on_publish' } as const;
    const end = { kind: 'event_start' } as const;
    expect(onSale(start, end, event, new Date('2026-11-10T00:00:00Z'))).toBe(true);
    expect(onSale(start, end, event, new Date('2026-11-14T08:00:00Z'))).toBe(false);
    expect(onSale(start, end, { ...event, publishedAt: null }, new Date('2026-11-10'))).toBe(false);
  });

  it('waits for a fixed sales start', () => {
    const start = { kind: 'at', at: '2026-11-12T00:00:00Z' } as const;
    expect(onSale(start, { kind: 'event_start' }, event, new Date('2026-11-10'))).toBe(false);
    expect(onSale(start, { kind: 'event_start' }, event, new Date('2026-11-13'))).toBe(true);
  });

  it('rejects a window that ends before it starts once both are known', () => {
    const start = { kind: 'at', at: '2026-11-14T07:30:00Z' } as const;
    expect(windowIsValid(start, { kind: 'hour_before' }, event)).toBe(false);
    expect(windowIsValid(start, { kind: 'event_end' }, event)).toBe(true);
    expect(windowIsValid(start, { kind: 'hour_before' }, { ...event, startsAt: null })).toBe(true);
  });
});

describe('event availability', () => {
  const type = (onSale: boolean, spotsLeft: number, soldOut = false) => ({
    onSale,
    spotsLeft,
    soldOut,
  });

  it('counts only the types on sale', () => {
    // The only type on sale is full of holds; the other one opens later (QA on #66).
    expect(eventAvailability([type(true, 0), type(false, 50)])).toEqual({
      spotsLeft: 0,
      soldOut: false,
    });
    expect(eventAvailability([type(true, 0, true), type(false, 50)])).toEqual({
      spotsLeft: 0,
      soldOut: true,
    });
    expect(eventAvailability([type(true, 3), type(true, 4), type(false, 50)]).spotsLeft).toBe(7);
  });

  it('counts every type when nothing is on sale', () => {
    expect(eventAvailability([type(false, 10), type(false, 5)])).toEqual({
      spotsLeft: 15,
      soldOut: false,
    });
    expect(eventAvailability([type(false, 0, true)]).soldOut).toBe(true);
    expect(eventAvailability([])).toEqual({ spotsLeft: 0, soldOut: false });
  });
});
