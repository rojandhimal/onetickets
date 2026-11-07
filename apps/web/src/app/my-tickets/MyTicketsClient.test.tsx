import type { AttendeeSession, OrderTicketsDto } from '@onetickets/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as attendeeClient from '@/lib/attendee';
import { MyTicketsClient } from './MyTicketsClient';

describe('MyTicketsClient (S2-4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signed-out view (Row 4.2)', () => {
    beforeEach(() => {
      vi.spyOn(attendeeClient, 'fetchAttendeeSession').mockResolvedValue(null);
    });

    it('renders lookup form with heading and email input', async () => {
      render(<MyTicketsClient />);
      expect(await screen.findByRole('heading', { name: 'Find your tickets' })).toBeDefined();
      expect(screen.getByLabelText('Email')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Email me a link' })).toBeDefined();
    });

    it('submits email and shows confirmation without revealing account existence', async () => {
      const requestSpy = vi
        .spyOn(attendeeClient, 'requestAttendeeLink')
        .mockResolvedValueOnce({ ok: true });

      render(<MyTicketsClient />);
      const emailInput = await screen.findByLabelText('Email');
      const submitBtn = screen.getByRole('button', { name: 'Email me a link' });

      fireEvent.change(emailInput, { target: { value: 'buyer@example.test' } });
      fireEvent.click(submitBtn);

      expect(requestSpy).toHaveBeenCalledWith('buyer@example.test');
      expect(
        await screen.findByText(
          'Check your email. If buyer@example.test has tickets, the link is on its way.',
        ),
      ).toBeDefined();
    });

    it('shows error on rate limit', async () => {
      vi.spyOn(attendeeClient, 'requestAttendeeLink').mockResolvedValueOnce({
        ok: false,
        kind: 'rate-limited',
      });

      render(<MyTicketsClient />);
      const emailInput = await screen.findByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'buyer@example.test' } });
      fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }));

      expect(
        await screen.findByText(
          'Too many requests. Please wait a few minutes before trying again.',
        ),
      ).toBeDefined();
    });
  });

  describe('signed-in view (Row 4.1 & 4.7)', () => {
    const mockSession: AttendeeSession = {
      email: 'buyer@example.test',
      expiresAt: '2026-11-20T00:00:00Z',
      permissions: ['tickets:read'],
    };

    const makeOrder = (
      id: string,
      name: string,
      startsAt: string,
      endsAt: string,
    ): OrderTicketsDto => ({
      orderId: id,
      email: 'buyer@example.test',
      event: {
        slug: id,
        name,
        startsAt,
        endsAt,
        timeZone: 'Australia/Sydney',
        venue: {
          kind: 'place',
          placeId: 'p1',
          name: 'The Workshop',
          address: '123 Test St',
          suburb: 'Marrickville',
          city: 'sydney',
          lat: -33.9,
          lng: 151.1,
        },
        organiser: { name: 'Organiser One' },
      },
      tickets: [
        {
          id: 't1',
          ticketTypeId: 'tt1',
          ref: 'ABCD1234',
          holderName: 'Test Buyer',
          ticketTypeName: 'General Admission',
          qr: 'fake-qr',
          status: 'valid',
          issuedAt: '2026-10-01T00:00:00Z',
        },
      ],
    });

    it('renders upcoming orders, tab counts, and show QR button', async () => {
      const upcomingOrder = makeOrder(
        'order-upcoming',
        'Future Fest',
        '2026-12-10T10:00:00Z',
        '2026-12-10T15:00:00Z',
      );
      const pastOrder = makeOrder(
        'order-past',
        'Past Gig',
        '2026-10-10T10:00:00Z',
        '2026-10-10T15:00:00Z',
      );

      vi.spyOn(attendeeClient, 'fetchAttendeeSession').mockResolvedValue(mockSession);
      vi.spyOn(attendeeClient, 'fetchAttendeeOrders').mockResolvedValue([upcomingOrder, pastOrder]);

      render(<MyTicketsClient initialSession={mockSession} />);

      expect(await screen.findByRole('heading', { name: 'My tickets' })).toBeDefined();
      expect(screen.getByText('buyer@example.test')).toBeDefined();

      // Check tabs
      const upcomingTab = screen.getByRole('tab', { name: 'Upcoming (1)' });
      const pastTab = screen.getByRole('tab', { name: 'Past (1)' });
      expect(upcomingTab).toBeDefined();
      expect(pastTab).toBeDefined();

      // In upcoming tab:
      expect(screen.getByText('Future Fest')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Show QR for Future Fest' })).toHaveAttribute(
        'href',
        '/tickets/order-upcoming',
      );

      // Switch to past tab:
      fireEvent.click(pastTab);
      expect(screen.getByText('Past Gig')).toBeDefined();
      expect(screen.queryByText('Future Fest')).toBeNull();
    });

    it('renders empty state for upcoming with link to Browse (Row 4.7)', async () => {
      vi.spyOn(attendeeClient, 'fetchAttendeeSession').mockResolvedValue(mockSession);
      vi.spyOn(attendeeClient, 'fetchAttendeeOrders').mockResolvedValue([]);

      render(<MyTicketsClient initialSession={mockSession} />);

      expect(await screen.findByText('No upcoming tickets.')).toBeDefined();
      const browseLink = screen.getByRole('link', { name: 'Find something on this weekend' });
      expect(browseLink).toHaveAttribute('href', '/');
    });

    it('signs out and returns to lookup view', async () => {
      const signOutSpy = vi.spyOn(attendeeClient, 'signOutAttendee').mockResolvedValue();
      vi.spyOn(attendeeClient, 'fetchAttendeeOrders').mockResolvedValue([]);

      render(<MyTicketsClient initialSession={mockSession} />);

      const signOutBtn = await screen.findByRole('button', { name: 'Sign out' });
      fireEvent.click(signOutBtn);

      expect(signOutSpy).toHaveBeenCalled();
      expect(await screen.findByRole('heading', { name: 'Find your tickets' })).toBeDefined();
    });
  });
});
