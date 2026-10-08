import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/contract';

const getSession = vi.fn<() => Promise<Session | null>>();
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));
vi.mock('@sentry/nextjs', () => ({ setUser: vi.fn(), setTag: vi.fn() }));

const { default: OrganiserHomePage } = await import('./page');

const session: Session = {
  user: { id: 'usr_7', email: 'priya@printshed.com.au', name: 'Priya Natarajan' },
  organisation: { id: 'org_42', name: 'The Print Shed' },
};

beforeEach(() => {
  getSession.mockResolvedValue(session);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('organiser home', () => {
  it('sends signed-out visitors to sign in', async () => {
    getSession.mockResolvedValue(null);
    await expect(OrganiserHomePage()).rejects.toThrow('redirect:/signin');
  });

  it('greets the organiser and shows templates as coming soon while the wizard is off', async () => {
    render(await OrganiserHomePage());
    expect(screen.getByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
    expect(screen.getByText('The Print Shed')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(4);
    expect(screen.queryByRole('link', { name: /Workshop/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Start from a blank event' }),
    ).not.toBeInTheDocument();
  });

  it('links templates to the wizard when the flag is on', async () => {
    vi.stubEnv('FEATURE_EVENT_WIZARD', 'true');
    render(await OrganiserHomePage());
    expect(screen.getByRole('link', { name: /Workshop/ })).toHaveAttribute(
      'href',
      '/organiser/events/new?template=workshop',
    );
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });
});
