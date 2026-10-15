import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDraftDto, Session } from '@onetickets/shared';
import { draftEvent } from '@/test/event-fixture';

const getSession = vi.fn<() => Promise<Session | null>>();
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));
vi.mock('@sentry/nextjs', () => ({ setUser: vi.fn(), setTag: vi.fn() }));
const listEvents = vi.fn<() => Promise<EventDraftDto[] | null>>();
vi.mock('@/lib/events-server', () => ({ listEvents: () => listEvents() }));

const { default: OrganiserHomePage } = await import('./page');

const session: Session = {
  user: {
    id: 'usr_7',
    email: 'priya@printshed.com.au',
    name: 'Priya Natarajan',
    mfaEnabled: false,
  },
  organisation: { id: 'org_42', name: 'The Print Shed', role: 'owner' },
  organisations: [{ id: 'org_42', name: 'The Print Shed', role: 'owner' }],
};

beforeEach(() => {
  getSession.mockResolvedValue(session);
  listEvents.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('organiser home', () => {
  it('sends signed-out visitors to sign in', async () => {
    getSession.mockResolvedValue(null);
    await expect(OrganiserHomePage()).rejects.toThrow('redirect:/signin');
  });

  it('sends a new organiser with no organisation to name it first', async () => {
    getSession.mockResolvedValue({ ...session, organisation: null, organisations: [] });
    await expect(OrganiserHomePage()).rejects.toThrow('redirect:/organiser/setup');
  });

  it('greets the organiser and shows templates as coming soon while the wizard is off', async () => {
    render(await OrganiserHomePage());
    expect(screen.getByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
    expect(screen.getByText('The Print Shed')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(4);
    expect(screen.getByText('Workshop, coming soon')).toBeInTheDocument();
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

  it('tells finance and door staff who can create events once the wizard is on', async () => {
    vi.stubEnv('FEATURE_EVENT_WIZARD', 'true');
    const finance = { id: 'org_42', name: 'The Print Shed', role: 'finance' as const };
    getSession.mockResolvedValue({ ...session, organisation: finance, organisations: [finance] });
    render(await OrganiserHomePage());
    expect(
      screen.getByText(
        'Only owners and admins can create events. Ask an owner to add you as an admin.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Workshop/ })).not.toBeInTheDocument();
  });

  describe('with events', () => {
    const live = draftEvent({
      id: 'evt_live',
      name: 'Screen printing',
      status: 'published',
      slug: 'screen-printing-x1',
      startsAt: '2099-11-14T10:00:00+11:00',
      endsAt: '2099-11-14T13:00:00+11:00',
    });
    const draft = draftEvent({ id: 'evt_draft', name: null, lastStep: 'review' });

    it('opens Drafts when nothing is coming up, linking back to the last step', async () => {
      vi.stubEnv('FEATURE_EVENT_WIZARD', 'true');
      listEvents.mockResolvedValue([draft]);
      render(await OrganiserHomePage());
      expect(screen.getByRole('link', { name: /Drafts/ })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('heading', { name: 'Untitled event' })).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Finish setting up: Untitled event' }),
      ).toHaveAttribute('href', '/organiser/events/new/review?draft=evt_draft');
      expect(screen.getByRole('heading', { name: 'Start a new event' })).toBeInTheDocument();
    });

    it('shows upcoming events with bookings and a link to the event page', async () => {
      vi.stubEnv('FEATURE_EVENT_WIZARD', 'true');
      listEvents.mockResolvedValue([live, draft]);
      render(await OrganiserHomePage({ searchParams: Promise.resolve({}) }));
      expect(screen.getByRole('link', { name: /Upcoming/ })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('0 of 40 booked')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Open event page: Screen printing' }),
      ).toHaveAttribute('href', '/e/screen-printing-x1');
    });
  });
});
