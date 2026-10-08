import { describe, expect, it } from 'vitest';
import { welcomeLine } from './greeting';
import { googleStartUrl } from './auth-client';
import { ORGANISER_NAME_MAX, validateSignup } from './validation';

describe('validateSignup', () => {
  it('accepts an email and organiser name', () => {
    expect(
      validateSignup({ email: 'priya@printshed.com.au', organiserName: 'The Print Shed' }),
    ).toEqual([]);
  });

  it('asks for both fields when empty', () => {
    expect(validateSignup({ email: ' ', organiserName: '' }).map((e) => e.field)).toEqual([
      'email',
      'organiserName',
    ]);
  });

  it('explains a missing domain the way the design system does', () => {
    expect(validateSignup({ email: 'jordan@example', organiserName: 'J' })[0]?.message).toBe(
      'Add the part after the @, like gmail.com',
    );
  });

  it('caps the organiser name length', () => {
    const [error] = validateSignup({
      email: 'a@b.co',
      organiserName: 'x'.repeat(ORGANISER_NAME_MAX + 1),
    });
    expect(error?.field).toBe('organiserName');
  });
});

describe('googleStartUrl', () => {
  it('passes the organiser name when given', () => {
    expect(googleStartUrl(' The Print Shed ')).toBe(
      '/api/auth/google/start?organiserName=The%20Print%20Shed',
    );
  });
  it('omits it when blank', () => {
    expect(googleStartUrl('  ')).toBe('/api/auth/google/start');
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
