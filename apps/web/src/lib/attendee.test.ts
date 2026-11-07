import type { AttendeeOrdersDto, AttendeeSession, OrderTicketsDto } from '@onetickets/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAttendeeOrders,
  fetchAttendeeSession,
  requestAttendeeLink,
  signOutAttendee,
  splitOrders,
  verifyAttendeeLink,
} from './attendee';

describe('attendee client (S2-4)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestAttendeeLink', () => {
    it('returns ok: true on 202', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));
      const result = await requestAttendeeLink('attendee@example.test');
      expect(result).toEqual({ ok: true });
      expect(fetch).toHaveBeenCalledWith('/api/attendee/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'attendee@example.test' }),
      });
    });

    it('handles 429 rate limit', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 429 }));
      const result = await requestAttendeeLink('attendee@example.test');
      expect(result).toEqual({ ok: false, kind: 'rate-limited' });
    });

    it('handles 422 validation error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Enter a valid email' }), { status: 422 }),
      );
      const result = await requestAttendeeLink('bad');
      expect(result).toEqual({ ok: false, kind: 'invalid', message: 'Enter a valid email' });
    });
  });

  describe('verifyAttendeeLink', () => {
    it('returns session on 200', async () => {
      const mockSession: AttendeeSession = {
        email: 'attendee@example.test',
        expiresAt: '2026-11-20T00:00:00Z',
        permissions: ['tickets:read'],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockSession), { status: 200 }),
      );
      const result = await verifyAttendeeLink('valid-token-string-123456789012345678901234');
      expect(result).toEqual({ ok: true, session: mockSession });
    });

    it('returns expired on 410', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 410 }));
      const result = await verifyAttendeeLink('expired-token');
      expect(result).toEqual({ ok: false, kind: 'expired' });
    });
  });

  describe('fetchAttendeeSession', () => {
    it('returns session when logged in', async () => {
      const mockSession: AttendeeSession = {
        email: 'attendee@example.test',
        expiresAt: '2026-11-20T00:00:00Z',
        permissions: ['tickets:read'],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockSession), { status: 200 }),
      );
      const session = await fetchAttendeeSession();
      expect(session).toEqual(mockSession);
    });

    it('returns null on 401', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));
      const session = await fetchAttendeeSession();
      expect(session).toBeNull();
    });
  });

  describe('signOutAttendee', () => {
    it('posts to sign-out endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
      await signOutAttendee();
      expect(fetch).toHaveBeenCalledWith('/api/attendee/sign-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    });
  });

  describe('fetchAttendeeOrders', () => {
    it('fetches and paginates orders', async () => {
      const page1: AttendeeOrdersDto = {
        orders: [
          {
            orderId: 'order-1',
            email: 'attendee@example.test',
            event: {
              slug: 'event-1',
              name: 'Event 1',
              startsAt: '2026-12-01T10:00:00Z',
              endsAt: '2026-12-01T12:00:00Z',
              timeZone: 'Australia/Sydney',
              venue: { kind: 'online' },
              organiser: { name: 'Org 1' },
            },
            tickets: [],
          },
        ],
        nextCursor: 'cursor-123',
      };
      const page2: AttendeeOrdersDto = {
        orders: [
          {
            orderId: 'order-2',
            email: 'attendee@example.test',
            event: {
              slug: 'event-2',
              name: 'Event 2',
              startsAt: '2026-12-02T10:00:00Z',
              endsAt: '2026-12-02T12:00:00Z',
              timeZone: 'Australia/Sydney',
              venue: { kind: 'online' },
              organiser: { name: 'Org 2' },
            },
            tickets: [],
          },
        ],
        nextCursor: null,
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));

      const orders = await fetchAttendeeOrders();
      expect(orders).toHaveLength(2);
      expect(orders[0]!.orderId).toBe('order-1');
      expect(orders[1]!.orderId).toBe('order-2');
      expect(fetch).toHaveBeenNthCalledWith(1, '/api/attendee/orders', expect.any(Object));
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        '/api/attendee/orders?after=cursor-123',
        expect.any(Object),
      );
    });
  });

  describe('splitOrders', () => {
    const fixedNow = new Date('2026-11-15T12:00:00Z');

    const makeOrder = (id: string, startsAt: string, endsAt: string): OrderTicketsDto => ({
      orderId: id,
      email: 'attendee@example.test',
      event: {
        slug: id,
        name: `Event ${id}`,
        startsAt,
        endsAt,
        timeZone: 'Australia/Sydney',
        venue: { kind: 'online' },
        organiser: { name: 'Org' },
      },
      tickets: [],
    });

    it('splits into upcoming and past by endsAt, sorting upcoming asc and past desc', () => {
      const past1 = makeOrder('past-1', '2026-11-01T10:00:00Z', '2026-11-01T12:00:00Z');
      const past2 = makeOrder('past-2', '2026-11-10T10:00:00Z', '2026-11-10T12:00:00Z');
      const up1 = makeOrder('up-1', '2026-11-20T10:00:00Z', '2026-11-20T12:00:00Z');
      const up2 = makeOrder('up-2', '2026-11-16T10:00:00Z', '2026-11-16T12:00:00Z');

      const { upcoming, past } = splitOrders([past1, up1, past2, up2], fixedNow);

      expect(upcoming.map((o) => o.orderId)).toEqual(['up-2', 'up-1']);
      expect(past.map((o) => o.orderId)).toEqual(['past-2', 'past-1']);
    });
  });
});
