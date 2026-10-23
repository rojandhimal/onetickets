import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicEventDto } from '@onetickets/shared';
import { publicEvent } from '@/test/event-fixture';
import EventPage, { generateMetadata } from './page';

let event: PublicEventDto | null = publicEvent();
vi.mock('@/lib/public-events', () => ({ getPublicEvent: vi.fn(async () => event) }));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

async function renderPage() {
  render(await EventPage({ params: Promise.resolve({ slug: 'screen-printing' }) }));
}

beforeEach(() => {
  event = publicEvent();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('event page', () => {
  it('shows the key facts above the fold in the design order', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Screen printing for beginners',
    );
    expect(screen.getByText('Sat 14 Nov · 10:00 am to 1:00 pm')).toBeInTheDocument();
    expect(screen.getByText('by The Print Shed')).toBeInTheDocument();

    const terms = screen.getAllByRole('term').map((t) => t.textContent);
    expect(terms).toEqual(['Price', 'Venue', 'Cancellations', 'Accessibility']);
    const facts = screen.getAllByRole('definition').map((d) => d.textContent);
    expect(facts[0]).toBe('FreeNo booking fee. 18 spots left.');
    expect(facts[1]).toContain('12 Sydenham Rd, Marrickville NSW 2204');
    expect(facts[2]).toBe('Cancel any timeRelease your ticket up to the start.');
    expect(facts[3]).toBe('Step-free accessAccessible toilet · Seating available · Details');
    expect(screen.getAllByRole('link', { name: 'Open map of The Print Shed' })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/search/?api=1&query='),
    );
  });

  it('shows the banner at its focal point, or the template colour when turned off', async () => {
    const { container } = render(
      await EventPage({ params: Promise.resolve({ slug: 'screen-printing' }) }),
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/public/banners/b1.webp');
    expect(img).toHaveAttribute('alt', '');
    expect(img?.style.objectPosition).toBe('50% 25%');
    container.remove();

    vi.stubEnv('FEATURE_EVENT_BANNER', 'false');
    await renderPage();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('renders organiser text as text, never as markup', async () => {
    event = publicEvent({
      about: '<img src=x onerror=alert(1)>Bring an apron',
      accessibility: { features: [], notes: '<script>alert(1)</script>' },
    });
    const { container } = render(
      await EventPage({ params: Promise.resolve({ slug: 'screen-printing' }) }),
    );
    expect(screen.getByText('<img src=x onerror=alert(1)>Bring an apron')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('says so when there are no accessibility details', async () => {
    event = publicEvent({ accessibility: { features: [], notes: '' } });
    await renderPage();
    expect(screen.getByText('No accessibility details yet')).toBeInTheDocument();
    expect(
      screen.getByText('Booked? Reply to your confirmation email to ask the organiser.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Accessibility' })).toBeNull();
  });

  it('keeps an online link private and shows no map', async () => {
    event = publicEvent({ venue: { kind: 'online' } });
    await renderPage();
    expect(screen.getByText('Online event')).toBeInTheDocument();
    expect(screen.getByText('You get the link with your ticket.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open map/ })).toBeNull();
  });

  it('holds tickets until booking ships, then links to them', async () => {
    await renderPage();
    const bar = screen.getByRole('complementary', { name: 'Tickets' });
    expect(within(bar).getByText('Tickets open soon')).toBeInTheDocument();
    expect(within(bar).getByText('18 spots left')).toBeInTheDocument();
    document.body.innerHTML = '';

    vi.stubEnv('FEATURE_BOOKING', 'true');
    await renderPage();
    expect(screen.getByRole('link', { name: 'Get tickets' })).toHaveAttribute(
      'href',
      '/e/screen-printing/tickets',
    );
  });

  it('shows a sold-out label instead of Get tickets only when every ticket is sold', async () => {
    vi.stubEnv('FEATURE_BOOKING', 'true');
    event = { ...publicEvent(), spotsLeft: 0, soldOut: true };
    await renderPage();
    let bar = screen.getByRole('complementary', { name: 'Tickets' });
    expect(within(bar).getByText('Sold out')).toBeInTheDocument();
    expect(within(bar).getByText('All tickets taken')).toBeInTheDocument();
    expect(within(bar).queryByRole('link', { name: 'Get tickets' })).toBeNull();
    expect(
      screen.getByText('Sold out; spots that are released go back on sale here.'),
    ).toBeInTheDocument();
    document.body.innerHTML = '';

    // Held by other checkouts, not sold: still bookable, never "Sold out".
    event = { ...publicEvent(), spotsLeft: 0, soldOut: false };
    await renderPage();
    bar = screen.getByRole('complementary', { name: 'Tickets' });
    expect(within(bar).queryByText('Sold out')).toBeNull();
    expect(within(bar).getByText('All taken right now')).toBeInTheDocument();
    expect(within(bar).getByRole('link', { name: 'Get tickets' })).toBeInTheDocument();
    expect(
      screen.getByText('All taken right now. Check back in a few minutes.'),
    ).toBeInTheDocument();
  });

  it('is a 404 for an unknown event', async () => {
    event = null;
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('describes the event for link previews', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'screen-printing' }) });
    expect(meta.title).toBe('Screen printing for beginners');
    expect(meta.description).toBe('Sat 14 Nov · 10:00 am · The Print Shed, Marrickville · Free');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
