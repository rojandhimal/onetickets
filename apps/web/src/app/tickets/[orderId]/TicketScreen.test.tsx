import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TICKETS_CACHE } from '@/lib/tickets';
import { orderFixture, ticketFixture } from '@/test/order-fixture';
import { TicketScreen } from './TicketScreen';

const KEY = 'tk_abcdefghijklmnop';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function api(handler: () => Response | Promise<Response>) {
  const fetch = vi.fn(async () => handler());
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => {
  window.location.hash = `#key=${KEY}`;
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:ics', revokeObjectURL: () => undefined }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('ticket screen', () => {
  it("says you're going and shows one ticket at a time", async () => {
    const fetch = api(() => json(orderFixture()));
    const user = userEvent.setup();
    render(<TicketScreen orderId="ord_1" />);

    expect(await screen.findByRole('heading', { name: "You're going!" })).toBeInTheDocument();
    expect(
      screen.getByText("We've also emailed your tickets to jordan@example.test"),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/public/orders/ord_1/tickets', {
      headers: { authorization: `Bearer ${KEY}` },
      cache: 'no-store',
    });

    const stub = screen.getByRole('article', { name: 'Ticket 1 of 2' });
    expect(stub).toHaveTextContent('Sat 14 Nov · 10:00 am');
    expect(stub).toHaveTextContent('Screen printing for beginners');
    expect(stub).toHaveTextContent('The Print Shed, 12 Sydenham Rd, Marrickville NSW 2204');
    expect(screen.getByRole('img', { name: 'QR code for ticket 7K4Q-2M9X' })).toBeInTheDocument();
    expect(stub).toHaveTextContent('NameJordan Lee');
    expect(stub).toHaveTextContent(
      'Screen brightness goes up while this is open so the door can scan it.',
    );

    const position = screen.getByText('Ticket 1 of 2');
    expect(position).toHaveAttribute('aria-live', 'polite');
    const previous = screen.getByRole('button', { name: 'Previous ticket' });
    const next = screen.getByRole('button', { name: 'Next ticket' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');

    await user.click(next);
    expect(position).toHaveTextContent('Ticket 2 of 2');
    expect(screen.getByRole('article', { name: 'Ticket 2 of 2' })).toHaveTextContent('Sam Lee');
    expect(screen.getByRole('img', { name: 'QR code for ticket 7K4Q-5TQ3' })).toBeInTheDocument();
    expect(next).toHaveAttribute('aria-disabled', 'true');
    // Pressing a button at the end keeps focus there and does nothing.
    await user.click(next);
    expect(next).toHaveFocus();
    expect(position).toHaveTextContent('Ticket 2 of 2');
    await user.click(previous);
    expect(position).toHaveTextContent('Ticket 1 of 2');
  });

  it('moves between tickets with a sideways swipe, not a scroll', async () => {
    api(() => json(orderFixture()));
    render(<TicketScreen orderId="ord_1" />);
    const stub = await screen.findByRole('article', { name: 'Ticket 1 of 2' });
    fireEvent.pointerDown(stub, { clientX: 300, clientY: 400 });
    fireEvent.pointerUp(stub, { clientX: 200, clientY: 410 });
    expect(screen.getByRole('article', { name: 'Ticket 2 of 2' })).toBeInTheDocument();
    // Mostly vertical: that's the page scrolling.
    fireEvent.pointerDown(stub, { clientX: 200, clientY: 400 });
    fireEvent.pointerUp(stub, { clientX: 260, clientY: 200 });
    expect(screen.getByRole('article', { name: 'Ticket 2 of 2' })).toBeInTheDocument();
    fireEvent.pointerDown(stub, { clientX: 100, clientY: 400 });
    fireEvent.pointerUp(stub, { clientX: 220, clientY: 400 });
    expect(screen.getByRole('article', { name: 'Ticket 1 of 2' })).toBeInTheDocument();
  });

  it('shows a single ticket without the pager', async () => {
    api(() => json(orderFixture({ tickets: [ticketFixture()] })));
    render(<TicketScreen orderId="ord_1" />);
    expect(
      await screen.findByText("We've also emailed your ticket to jordan@example.test"),
    ).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Ticket 1 of 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next ticket' })).not.toBeInTheDocument();
  });

  it('shows a released ticket without its QR', async () => {
    api(() => json(orderFixture({ tickets: [ticketFixture({ status: 'released' })] })));
    render(<TicketScreen orderId="ord_1" />);
    expect(await screen.findByText('Released. This QR no longer works.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument();
  });

  it('keeps the screen on while a QR shows, and lets go on leaving', async () => {
    api(() => json(orderFixture()));
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ released: false, release }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const view = render(<TicketScreen orderId="ord_1" />);
    await screen.findByRole('article', { name: 'Ticket 1 of 2' });
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    view.unmount();
    expect(release).toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('offers an .ics file and Google Calendar', async () => {
    api(() => json(orderFixture()));
    const user = userEvent.setup();
    render(<TicketScreen orderId="ord_1" />);
    const button = await screen.findByRole('button', { name: 'Add to calendar' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const ics = screen.getByRole('link', { name: 'Apple, Outlook and others (.ics)' });
    expect(ics).toHaveAttribute('href', 'blob:ics');
    expect(ics).toHaveAttribute('download', 'screen-printing-k7q4.ics');
    const google = screen.getByRole('link', { name: 'Google Calendar' });
    expect(google.getAttribute('href')).toMatch(
      /^https:\/\/calendar\.google\.com\/calendar\/render\?/,
    );
    expect(google).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('button', { name: /wallet/i })).not.toBeInTheDocument();
  });

  it('says so when the link has no key or a wrong one', async () => {
    window.location.hash = '';
    const fetch = api(() => json({}, 404));
    const view = render(<TicketScreen orderId="ord_1" />);
    expect(
      await screen.findByRole('heading', { name: "We couldn't find these tickets" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    view.unmount();

    window.location.hash = `#key=${KEY}`;
    render(<TicketScreen orderId="ord_1" />);
    expect(
      await screen.findByText('Open the link in your confirmation email to see them.'),
    ).toBeInTheDocument();
  });

  it('asks to try again when offline with nothing saved', async () => {
    let online = false;
    api(() => {
      if (!online) throw new TypeError('Failed to fetch');
      return json(orderFixture());
    });
    const user = userEvent.setup();
    render(<TicketScreen orderId="ord_1" />);
    expect(
      await screen.findByText("We couldn't reach OneTickets. Check your connection and try again."),
    ).toBeInTheDocument();
    online = true;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: "You're going!" })).toBeInTheDocument();
  });

  it('says it works offline once the tickets and page are saved on the phone', async () => {
    const order = orderFixture();
    const stored = new Map<string, Response>();
    const cache = {
      put: vi.fn(async (url: string, res: Response) => void stored.set(url, res)),
      match: vi.fn(async (url: string) => stored.get(url)),
    };
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    const register = vi.fn(async () => ({}));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, ready: Promise.resolve({}) },
      configurable: true,
    });
    api(() => json(order));
    render(<TicketScreen orderId="ord_1" />);
    expect(await screen.findByText('Works offline')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('/tickets-sw.js', { scope: '/tickets/' });
    expect(caches.open).toHaveBeenCalledWith(TICKETS_CACHE);
    expect(await stored.get('/api/public/orders/ord_1/tickets')?.clone().json()).toEqual(order);
    expect(stored.has(window.location.pathname)).toBe(true);
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('shows loading first', async () => {
    let resolve: (r: Response) => void = () => undefined;
    api(() => new Promise<Response>((r) => (resolve = r)));
    render(<TicketScreen orderId="ord_1" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your tickets…');
    await act(async () => resolve(json(orderFixture())));
    expect(await screen.findByRole('heading', { name: "You're going!" })).toBeInTheDocument();
  });
});
