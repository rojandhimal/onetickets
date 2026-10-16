import { describe, expect, it } from 'vitest';
import { EVENT_LIMITS } from '@onetickets/shared';
import { STARTER_ABOUT, apiTemplate } from './templates';

describe('apiTemplate', () => {
  it('maps the template rows to the api ids, and anything else to blank', () => {
    expect(apiTemplate('workshop')).toBe('workshop');
    expect(apiTemplate('school-night')).toBe('school_night');
    expect(apiTemplate(undefined)).toBe('blank');
    expect(apiTemplate('../../admin')).toBe('blank');
  });
});

describe('STARTER_ABOUT', () => {
  it('gives every template but blank a starter paragraph within the About limit', () => {
    expect(STARTER_ABOUT.blank).toBe('');
    for (const t of ['workshop', 'gig', 'school_night', 'meetup'] as const) {
      expect(STARTER_ABOUT[t].length).toBeGreaterThan(20);
      expect(STARTER_ABOUT[t].length).toBeLessThanOrEqual(EVENT_LIMITS.about);
    }
  });
});
