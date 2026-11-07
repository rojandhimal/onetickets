import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MyTicketsPage from './page';
import VerifyAttendeePage from './verify/page';

const mockNotFound = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: () => {
    mockNotFound();
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

describe('MyTickets server page gating (S2-4)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns 404 when FEATURE_ATTENDEE_TICKETS is false', async () => {
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'false');
    await expect(MyTicketsPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('renders MyTicketsClient when FEATURE_ATTENDEE_TICKETS is true', async () => {
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'true');
    const jsx = await MyTicketsPage();
    await vi.waitFor(() => {
      render(jsx);
    });
    expect(screen.getByText('Loading tickets…')).toBeDefined();
  });

  it('verify page returns 404 when flag is false', async () => {
    vi.stubEnv('FEATURE_ATTENDEE_TICKETS', 'false');
    await expect(VerifyAttendeePage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });
});
