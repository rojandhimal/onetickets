import { describe, expect, it } from 'vitest';
import { missingForPublish, slugFor } from './publish-check.js';

const now = new Date('2026-11-01T00:00:00Z');
const ready = {
  name: 'Pottery night',
  startsAt: new Date('2026-11-14T08:00:00Z'),
  endsAt: new Date('2026-11-14T11:00:00Z'),
  hasVenue: true,
  ticketTypeCount: 1,
};

describe('publish checklist', () => {
  it('passes a complete event', () => {
    expect(missingForPublish(ready, now)).toEqual([]);
  });

  it('lists everything missing, in checklist order', () => {
    expect(
      missingForPublish(
        { name: null, startsAt: null, endsAt: null, hasVenue: false, ticketTypeCount: 0 },
        now,
      ),
    ).toEqual(['name', 'date_time', 'venue', 'ticket_type']);
  });

  it('needs both times, in order, and in the future', () => {
    expect(missingForPublish({ ...ready, endsAt: null }, now)).toEqual(['date_time']);
    expect(missingForPublish({ ...ready, endsAt: ready.startsAt }, now)).toEqual(['date_time']);
    expect(missingForPublish(ready, new Date('2026-11-15T00:00:00Z'))).toEqual(['date_time']);
  });
});

describe('slugFor', () => {
  it('turns the name into a short kebab-case address', () => {
    expect(slugFor('Café Pottery Night: Beginners!', 'k3x9q2')).toBe(
      'cafe-pottery-night-beginners-k3x9q2',
    );
    expect(slugFor('🎉🎉', 'k3x9q2')).toBe('k3x9q2');
    expect(slugFor('a'.repeat(100), 'k3x9q2')).toHaveLength(67);
  });
});
