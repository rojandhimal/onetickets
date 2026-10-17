import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowseCardDto } from '@onetickets/shared';
import Home from './page';

const sydneyWorkshop: BrowseCardDto = {
  slug: 'screen-printing',
  name: 'Screen printing for beginners',
  startsAt: '2026-11-14T10:00:00+11:00',
  timeZone: 'Australia/Sydney',
  template: 'workshop',
  suburb: 'Marrickville',
  venueName: 'The Print Shed',
  online: false,
  banner: {
    url: '/api/public/banners/b1.webp',
    ogUrl: '/api/public/banners/b1-og.jpg',
    width: 2160,
    height: 1080,
    focus: { x: 0.5, y: 0.25 },
  },
  priceFromAllInCents: 0,
};

const paidGig: BrowseCardDto = {
  slug: 'late-brass',
  name: 'Late Brass Orchestra',
  startsAt: '2026-11-14T20:00:00+11:00',
  timeZone: 'Australia/Sydney',
  template: 'gig',
  suburb: 'Newtown',
  venueName: 'Newtown Community Centre',
  online: false,
  banner: null,
  priceFromAllInCents: 5335,
};

const melbourneGig: BrowseCardDto = {
  slug: 'collingwood-synth',
  name: 'Collingwood Synth Night',
  startsAt: '2026-11-15T19:30:00+11:00',
  timeZone: 'Australia/Melbourne',
  template: 'gig',
  suburb: 'Collingwood',
  venueName: 'The Tote',
  online: false,
  banner: null,
  priceFromAllInCents: 0,
};

let serverItems: BrowseCardDto[] = [sydneyWorkshop, paidGig];
const browseEventsMock = vi.fn(async (_filters: unknown) => ({
  items: serverItems,
  nextCursor: null,
}));

vi.mock('@/lib/public-events', () => ({
  browseEvents: (filters: unknown) => browseEventsMock(filters),
}));

beforeEach(() => {
  serverItems = [sydneyWorkshop, paidGig];
  browseEventsMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('public browse page (S1-5)', () => {
  it('renders upcoming events with four-fact card links, Free badge, and all-in pricing', async () => {
    render(await Home());

    expect(browseEventsMock).toHaveBeenCalledWith({ city: 'sydney' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Coming up near you');
    expect(
      screen.getByText('Prices shown are what you pay. No fees added later.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 events');

    const workshopLink = screen.getByRole('link', {
      name: 'Screen printing for beginners, Sat 14 Nov · 10:00 am, Marrickville · The Print Shed, Free',
    });
    expect(workshopLink).toHaveAttribute('href', '/e/screen-printing');
    expect(within(workshopLink).getByText('Marrickville · The Print Shed')).toBeInTheDocument();
    expect(within(workshopLink).getAllByText('Free')).toHaveLength(2); // badge + price line

    const gigLink = screen.getByRole('link', {
      name: 'Late Brass Orchestra, Sat 14 Nov · 8:00 pm, Newtown · Newtown Community Centre, From A$53.35 all-in',
    });
    expect(gigLink).toHaveAttribute('href', '/e/late-brass');
    expect(within(gigLink).getByText('From A$53.35 all-in')).toBeInTheDocument();
    expect(within(gigLink).getByText('Gig')).toBeInTheDocument();
  });

  it('hides banner images and shows the template word when FEATURE_EVENT_BANNER is false', async () => {
    vi.stubEnv('FEATURE_EVENT_BANNER', 'false');
    const { container } = render(await Home());
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('switches city and toggles deselectable When and Price chips', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('city=melbourne')) {
        return new Response(JSON.stringify({ items: [melbourneGig], nextCursor: null }), {
          status: 200,
        });
      }
      if (url.includes('when=tonight')) {
        return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [sydneyWorkshop, paidGig], nextCursor: null }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(await Home());

    const whenGroup = screen.getByRole('group', { name: 'When' });
    const tonightChip = within(whenGroup).getByRole('button', { name: 'Tonight' });
    expect(tonightChip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(tonightChip);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('On tonight');
    });
    expect(tonightChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Nothing on for that yet. Try Next 7 days.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 events');

    // Tapping Tonight again deselects it and restores the default heading.
    fireEvent.click(tonightChip);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Coming up near you');
    });
    expect(tonightChip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('2 events');

    // Switching city updates the trigger and list.
    fireEvent.click(screen.getByRole('button', { name: /Near Sydney/ }));
    const cityGroup = screen.getByRole('group', { name: 'City' });
    fireEvent.click(within(cityGroup).getByRole('button', { name: 'Melbourne' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Near Melbourne/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Collingwood Synth Night' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 event');
  });

  it('renders untrusted card titles and venues as text only', async () => {
    serverItems = [
      {
        ...sydneyWorkshop,
        name: '<script>alert(1)</script>Ceramics',
        venueName: '<img src=x onerror=alert(1)>Studio',
      },
    ];
    const { container } = render(await Home());
    expect(screen.getByText('<script>alert(1)</script>Ceramics')).toBeInTheDocument();
    expect(
      screen.getByText('Marrickville · <img src=x onerror=alert(1)>Studio'),
    ).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });
});
