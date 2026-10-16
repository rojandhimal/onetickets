import { describe, expect, it } from 'vitest';
import { formatAud } from './money.js';

describe('formatAud', () => {
  it('formats whole cents as Australian dollars', () => {
    expect(formatAud(5335)).toBe('A$53.35');
    expect(formatAud(0)).toBe('A$0.00');
    expect(formatAud(123456)).toBe('A$1,234.56');
    expect(formatAud(-500)).toBe('-A$5.00');
  });

  it('rejects fractional cents', () => {
    expect(() => formatAud(1.5)).toThrow(RangeError);
  });
});
