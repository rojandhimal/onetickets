import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as attendeeClient from '@/lib/attendee';
import { VerifyAttendeeClient } from './VerifyAttendeeClient';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

describe('VerifyAttendeeClient (S2-4 / Row 4.3)', () => {
  const originalLocation = window.location;
  const originalReplaceState = window.history.replaceState;

  beforeEach(() => {
    mockReplace.mockReset();
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState = originalReplaceState;
  });

  it('extracts token from fragment, immediately strips hash, verifies and redirects', async () => {
    // Set up fragment
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        hash: '#token=securetoken123456789012345678901234567890',
        pathname: '/my-tickets/verify',
      },
    });

    const verifySpy = vi.spyOn(attendeeClient, 'verifyAttendeeLink').mockResolvedValueOnce({
      ok: true,
      session: {
        email: 'attendee@example.test',
        expiresAt: '2026-11-20T00:00:00Z',
        permissions: ['tickets:read'],
      },
    });

    render(<VerifyAttendeeClient />);

    // Row 4.3: fragment is immediately stripped
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/my-tickets/verify');

    // Called verify with extracted token
    expect(verifySpy).toHaveBeenCalledWith('securetoken123456789012345678901234567890');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/my-tickets');
    });
  });

  it('displays expired message when token is expired (410)', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        hash: '#token=expiredtoken123',
        pathname: '/my-tickets/verify',
      },
    });

    vi.spyOn(attendeeClient, 'verifyAttendeeLink').mockResolvedValueOnce({
      ok: false,
      kind: 'expired',
    });

    render(<VerifyAttendeeClient />);

    expect(await screen.findByText("That link doesn't work any more.")).toBeDefined();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/my-tickets',
    );
  });

  it('displays failure message when no token is in hash', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        hash: '',
        pathname: '/my-tickets/verify',
      },
    });

    render(<VerifyAttendeeClient />);

    expect(await screen.findByText('Verification failed')).toBeDefined();
    expect(screen.getByText('No valid ticket link was found in the URL.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Return to My tickets' })).toHaveAttribute(
      'href',
      '/my-tickets',
    );
  });
});
