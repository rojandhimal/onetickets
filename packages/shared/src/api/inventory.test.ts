import { describe, expect, it } from 'vitest';
import { holdTokenBody, reserveHoldBody } from './inventory.js';

describe('inventory contracts', () => {
  describe('reserveHoldBody', () => {
    it('accepts valid reserve body with uuid and quantity', () => {
      const parsed = reserveHoldBody.safeParse({
        ticketTypeId: '11111111-1111-4111-8111-111111111111',
        quantity: 2,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.quantity).toBe(2);
      }
    });

    it('accepts optional previous hold information for quantity adjustment', () => {
      const parsed = reserveHoldBody.safeParse({
        ticketTypeId: '11111111-1111-4111-8111-111111111111',
        quantity: 3,
        previousHoldId: '22222222-2222-4222-8222-222222222222',
        previousToken: 'secret-token-value',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects zero or negative quantities', () => {
      expect(
        reserveHoldBody.safeParse({
          ticketTypeId: '11111111-1111-4111-8111-111111111111',
          quantity: 0,
        }).success,
      ).toBe(false);

      expect(
        reserveHoldBody.safeParse({
          ticketTypeId: '11111111-1111-4111-8111-111111111111',
          quantity: -1,
        }).success,
      ).toBe(false);
    });

    it('rejects quantities above maximum per order limit (100)', () => {
      expect(
        reserveHoldBody.safeParse({
          ticketTypeId: '11111111-1111-4111-8111-111111111111',
          quantity: 101,
        }).success,
      ).toBe(false);
    });

    it('rejects non-uuid ticketTypeId', () => {
      expect(
        reserveHoldBody.safeParse({
          ticketTypeId: 'not-a-uuid',
          quantity: 1,
        }).success,
      ).toBe(false);
    });
  });

  describe('holdTokenBody', () => {
    it('accepts non-empty token string', () => {
      expect(holdTokenBody.safeParse({ token: 'abc123xyz' }).success).toBe(true);
    });

    it('rejects empty token', () => {
      expect(holdTokenBody.safeParse({ token: '' }).success).toBe(false);
    });
  });
});
