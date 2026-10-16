import { describe, expect, it } from 'vitest';
import { allInPriceCents } from './pricing.js';

describe('pricing', () => {
  it('charges no fees while every ticket is free, and keeps free tickets free', () => {
    expect(allInPriceCents(0)).toBe(0);
    expect(allInPriceCents(1200)).toBeGreaterThan(0);
  });
});
