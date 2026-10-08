import { describe, expect, it } from 'vitest';
import { formatAud } from './money.js';

describe('formatAud', () => {
  it('formats whole cents as Australian dollars', () => {
    expect(formatAud(5335)).toBe('$53.35');
    expect(formatAud(0)).toBe('$0.00');
  });

  it('rejects fractional cents', () => {
    expect(() => formatAud(1.5)).toThrow(RangeError);
  });
});
