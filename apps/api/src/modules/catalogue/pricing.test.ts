import { describe, expect, it } from 'vitest';
import { allInPriceCents, fromPriceCents } from './pricing.js';

describe('pricing', () => {
  it('charges no fees while every ticket is free', () => {
    expect(allInPriceCents(0)).toBe(0);
  });

  it('shows the cheapest all-in price, or 0 with no ticket types', () => {
    expect(fromPriceCents([2500, 0, 1000])).toBe(0);
    expect(fromPriceCents([2500, 1000])).toBe(allInPriceCents(1000));
    expect(fromPriceCents([])).toBe(0);
  });

  it('is free exactly when some ticket type costs nothing, as the browse filter assumes', () => {
    for (const prices of [[0], [0, 500], [500], [500, 9_900], [1]]) {
      expect(fromPriceCents(prices) === 0).toBe(prices.some((p) => p === 0));
    }
  });
});
