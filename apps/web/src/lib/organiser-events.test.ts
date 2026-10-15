import { describe, expect, it } from 'vitest';
import { draftEvent } from '@/test/event-fixture';
import { eventCard, pickView, splitEvents } from './organiser-events';

const now = new Date('2026-11-01T00:00:00Z');
const published = (id: string, startsAt: string, endsAt: string) =>
  draftEvent({ id, status: 'published', slug: id, name: id, startsAt, endsAt });

describe('organiser events', () => {
  it('keeps published events that have not ended, soonest first, and drafts newest first', () => {
    const past = published('past', '2026-10-01T10:00:00+10:00', '2026-10-01T12:00:00+10:00');
    const later = published('later', '2026-12-01T10:00:00+11:00', '2026-12-01T12:00:00+11:00');
    const soon = published('soon', '2026-11-05T10:00:00+11:00', '2026-11-05T12:00:00+11:00');
    const oldDraft = draftEvent({ id: 'd1', updatedAt: '2026-10-01T00:00:00Z' });
    const newDraft = draftEvent({ id: 'd2', updatedAt: '2026-10-20T00:00:00Z' });
    const { upcoming, drafts } = splitEvents([past, later, oldDraft, soon, newDraft], now);
    expect(upcoming.map((e) => e.id)).toEqual(['soon', 'later']);
    expect(drafts.map((e) => e.id)).toEqual(['d2', 'd1']);
  });

  it('opens Drafts only when there is nothing upcoming', () => {
    expect(pickView(undefined, { upcoming: 0, drafts: 2 })).toBe('drafts');
    expect(pickView(undefined, { upcoming: 1, drafts: 2 })).toBe('upcoming');
    expect(pickView('drafts', { upcoming: 1, drafts: 0 })).toBe('drafts');
    expect(pickView('nonsense', { upcoming: 0, drafts: 0 })).toBe('upcoming');
  });

  it('describes a draft with no name or date', () => {
    expect(eventCard(draftEvent({ id: 'd1', name: null, startsAt: null }))).toMatchObject({
      title: 'Untitled event',
      when: 'Date to come',
      status: 'draft',
      sold: null,
      action: { label: 'Finish setting up' },
    });
  });
});
