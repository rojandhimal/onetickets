import { describe, expect, it } from 'vitest';
import { allInPriceCents, fromPriceCents } from './pricing.js';

const type = (priceCents: number, onSale = true) => ({ priceCents, onSale });

describe('pricing', () => {
  it('charges no fees while every ticket is free', () => {
    expect(allInPriceCents(0)).toBe(0);
  });

  it('shows the cheapest all-in price among the types on sale', () => {
    expect(fromPriceCents([type(2500), type(1000)])).toBe(allInPriceCents(1000));
    // A finished early bird no longer pulls the price down.
    expect(fromPriceCents([type(500, false), type(2500)])).toBe(allInPriceCents(2500));
  });

  it('falls back to every type when none is on sale, and 0 with none', () => {
    expect(fromPriceCents([type(2500, false), type(1000, false)])).toBe(allInPriceCents(1000));
    expect(fromPriceCents([])).toBe(0);
  });
});
