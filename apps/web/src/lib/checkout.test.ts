import { describe, expect, it } from 'vitest';
import { checkoutButtonLabel, holdNoticeText, validateCheckoutForm } from './checkout.js';

describe('validateCheckoutForm', () => {
  it('returns no errors for valid name and email', () => {
    expect(validateCheckoutForm({ name: 'Jordan Smith', email: 'jordan@example.com' })).toEqual({});
  });

  it('reports missing name', () => {
    const res = validateCheckoutForm({ name: '   ', email: 'jordan@example.com' });
    expect(res.name).toBe('Enter the name for the ticket');
    expect(res.email).toBeUndefined();
  });

  it('reports missing email', () => {
    const res = validateCheckoutForm({ name: 'Jordan', email: '' });
    expect(res.email).toBe('Enter your email address');
  });

  it('reports email missing @', () => {
    const res = validateCheckoutForm({ name: 'Jordan', email: 'jordanexample.com' });
    expect(res.email).toBe('Add an @, like jordan@example.com');
  });

  it('reports email missing domain after @', () => {
    const res = validateCheckoutForm({ name: 'Jordan', email: 'jordan@' });
    expect(res.email).toBe('Add the part after the @, like gmail.com');
  });

  it('reports email with incomplete domain', () => {
    const res = validateCheckoutForm({ name: 'Jordan', email: 'jordan@gmail' });
    expect(res.email).toBe('Add the part after the @, like gmail.com');
  });
});

describe('holdNoticeText', () => {
  it('formats single ticket correctly', () => {
    expect(holdNoticeText(1)).toBe(
      "We're holding 1 ticket for you while you finish. Take your time.",
    );
  });

  it('formats plural tickets correctly', () => {
    expect(holdNoticeText(3)).toBe(
      "We're holding 3 tickets for you while you finish. Take your time.",
    );
  });
});

describe('checkoutButtonLabel', () => {
  it('formats 0 tickets', () => {
    expect(checkoutButtonLabel(0, false)).toBe('Choose at least 1 ticket');
  });

  it('formats 1 ticket', () => {
    expect(checkoutButtonLabel(1, false)).toBe('Get 1 free ticket');
  });

  it('formats multiple tickets', () => {
    expect(checkoutButtonLabel(2, false)).toBe('Get 2 free tickets');
    expect(checkoutButtonLabel(5, false)).toBe('Get 5 free tickets');
  });

  it('formats booking state', () => {
    expect(checkoutButtonLabel(1, true)).toBe('Booking your ticket…');
    expect(checkoutButtonLabel(2, true)).toBe('Booking your tickets…');
  });
});
