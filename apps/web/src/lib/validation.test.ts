import { describe, expect, it } from 'vitest';
import { welcomeLine } from './greeting';
import { ORGANISER_NAME_MAX, validateEmail, validateOrganiserName } from './validation';

describe('validateEmail', () => {
  it('accepts a normal address', () => {
    expect(validateEmail(' priya@printshed.com.au ')).toBeNull();
  });
  it('asks for an email when empty', () => {
    expect(validateEmail(' ')).toBe('Enter your email address');
  });
  it('explains a missing domain the way the design system does', () => {
    expect(validateEmail('jordan@example')).toBe('Add the part after the @, like gmail.com');
  });
});

describe('validateOrganiserName', () => {
  it('accepts a name and rejects blank or overlong ones', () => {
    expect(validateOrganiserName('The Print Shed')).toBeNull();
    expect(validateOrganiserName('  ')).toMatch(/Enter an organiser name/);
    expect(validateOrganiserName('x'.repeat(ORGANISER_NAME_MAX + 1))).toMatch(
      /characters or fewer/,
    );
  });
});

describe('welcomeLine', () => {
  it('uses the first name', () => {
    expect(welcomeLine('Priya Natarajan')).toBe('Welcome, Priya');
  });
  it('falls back when there is no name', () => {
    expect(welcomeLine(null)).toBe('Welcome');
    expect(welcomeLine('  ')).toBe('Welcome');
  });
});
