import { describe, expect, it } from 'vitest';
import { apiTemplate } from './templates';

describe('apiTemplate', () => {
  it('maps the template rows to the api ids, and anything else to blank', () => {
    expect(apiTemplate('workshop')).toBe('workshop');
    expect(apiTemplate('school-night')).toBe('school_night');
    expect(apiTemplate(undefined)).toBe('blank');
    expect(apiTemplate('../../admin')).toBe('blank');
  });
});
