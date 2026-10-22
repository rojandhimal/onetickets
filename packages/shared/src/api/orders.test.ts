import { describe, expect, it } from 'vitest';
import { createFreeOrderBody } from './orders.js';

describe('createFreeOrderBody', () => {
  const valid = {
    eventId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    holdId: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    holdToken: 'test-token-12345',
    idempotencyKey: 'c8c0840b-04e4-44b2-9214-e22ff6b7e6ec',
    attendeeName: 'Jordan Smith',
    attendeeEmail: 'Jordan@Example.test',
    optInOrganiser: true,
  };

  it('accepts a valid free order submission and normalises email', () => {
    const parsed = createFreeOrderBody.parse(valid);
    expect(parsed.attendeeName).toBe('Jordan Smith');
    expect(parsed.attendeeEmail).toBe('jordan@example.test');
    expect(parsed.optInOrganiser).toBe(true);
  });

  it('defaults optInOrganiser to false when omitted', () => {
    const withoutOptIn = { ...valid, optInOrganiser: undefined };
    const parsed = createFreeOrderBody.parse(withoutOptIn);
    expect(parsed.optInOrganiser).toBe(false);
  });

  it('rejects empty or whitespace-only attendee name', () => {
    expect(() => createFreeOrderBody.parse({ ...valid, attendeeName: '   ' })).toThrow();
  });

  it('rejects invalid email address', () => {
    expect(() => createFreeOrderBody.parse({ ...valid, attendeeEmail: 'not-an-email' })).toThrow();
  });

  it('rejects non-uuid idempotency key or eventId', () => {
    expect(() => createFreeOrderBody.parse({ ...valid, idempotencyKey: 'not-a-uuid' })).toThrow();
    expect(() => createFreeOrderBody.parse({ ...valid, eventId: 'not-a-uuid' })).toThrow();
  });
});
