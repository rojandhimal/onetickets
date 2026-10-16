import { describe, expect, it } from 'vitest';
import { ABOUT_PROMPTS, apiTemplate } from './templates';

describe('apiTemplate', () => {
  it('maps the template rows to the api ids, and anything else to blank', () => {
    expect(apiTemplate('workshop')).toBe('workshop');
    expect(apiTemplate('school-night')).toBe('school_night');
    expect(apiTemplate(undefined)).toBe('blank');
    expect(apiTemplate('../../admin')).toBe('blank');
  });
});

describe('ABOUT_PROMPTS', () => {
  it('gives every template a question to prompt the About text', () => {
    for (const prompt of Object.values(ABOUT_PROMPTS)) expect(prompt).toMatch(/\S.{20,}[?.]$/);
    expect(new Set(Object.values(ABOUT_PROMPTS)).size).toBe(5);
  });
});
