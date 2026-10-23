import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPIRES_HEADER, TICKETS_CACHE, stashConfirmedOrder } from '@/lib/tickets';
import { fakeCaches } from '@/test/fake-caches';
import { orderFixture, ticketFixture } from '@/test/order-fixture';
import { TicketScreen } from './TicketScreen';

const KEY = 'tk_abcdefghijklmnop'; // gitleaks:allow (fake ticket key)
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** A copy saved on the phone, still within its date. */
const saved = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { [EXPIRES_HEADER]: '2099-01-01T00:00:00.000Z' },
  });

function api(handler: () => Response | Promise<Response>) {
  const fetch = vi.fn(async () => handler());
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => {
  sessionStorage.clear();
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
    expect(screen.getByRole('img', { name: 'QR code for ticket K7Q4-M2XA' })).toBeInTheDocument();
    expect(stub).toHaveTextContent('NameJordan Lee');
    expect(stub).toHaveTextContent('RefK7Q4-M2XA');
    expect(stub).toHaveTextContent(
      'Turn your screen brightness up at the door so it scans first time.',
    );
    // The key leaves the address bar at once and stays with this tab only.
    expect(window.location.hash).toBe('');
    expect(sessionStorage.getItem('onetickets:ticket-key:ord_1')).toBe(KEY);

    const position = screen.getByText('Ticket 1 of 2');
    expect(position).toHaveAttribute('aria-live', 'polite');
    const previous = screen.getByRole('button', { name: 'Previous ticket' });
    const next = screen.getByRole('button', { name: 'Next ticket' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');

    await user.click(next);
    expect(position).toHaveTextContent('Ticket 2 of 2');
    expect(screen.getByRole('article', { name: 'Ticket 2 of 2' })).toHaveTextContent('Sam Lee');
    expect(screen.getByRole('img', { name: 'QR code for ticket K7Q4-5TQ3' })).toBeInTheDocument();
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
    const swipe = (from: [number, number], to: [number, number], pointerType = 'touch') => {
      fireEvent.pointerDown(stub, { pointerType, clientX: from[0], clientY: from[1] });
      fireEvent.pointerUp(stub, { pointerType, clientX: to[0], clientY: to[1] });
    };
    swipe([300, 400], [200, 410]);
    expect(screen.getByRole('article', { name: 'Ticket 2 of 2' })).toBeInTheDocument();
    // Mostly vertical: that's the page scrolling.
    swipe([200, 400], [260, 200]);
    expect(screen.getByRole('article', { name: 'Ticket 2 of 2' })).toBeInTheDocument();
    // A mouse drag is selecting text, not swiping.
    swipe([100, 400], [220, 400], 'mouse');
    expect(screen.getByRole('article', { name: 'Ticket 2 of 2' })).toBeInTheDocument();
    swipe([100, 400], [220, 400]);
    expect(screen.getByRole('article', { name: 'Ticket 1 of 2' })).toBeInTheDocument();
  });

  it('shows a single ticket without the pager', async () => {
    api(() => json(orderFixture({ tickets: [ticketFixture()] })));
    render(<TicketScreen orderId="ord_1" />);
    expect(
      await screen.findByText("We've also emailed your ticket to jordan@example.test"),
    ).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Your ticket' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next ticket' })).not.toBeInTheDocument();
  });

  it('shows a revoked ticket without a QR or the brightness note', async () => {
    const revoked = ticketFixture({ status: 'revoked', qr: null });
    api(() => json(orderFixture({ tickets: [revoked, ticketFixture({ ref: 'K7Q45TQ3' })] })));
    render(<TicketScreen orderId="ord_1" />);
    const stub = await screen.findByRole('article', { name: 'Ticket 1 of 2' });
    expect(stub).toHaveTextContent(
      "This ticket is no longer valid. It was released or cancelled, so there's no QR to show. Questions? Reply to your ticket email to reach Marrickville Print Club.",
    );
    expect(stub).not.toHaveTextContent('screen brightness');
    expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "You're going!" })).toBeInTheDocument();
  });

  it('says "Your tickets" with no email line or calendar when every ticket is revoked', async () => {
    api(() => json(orderFixture({ tickets: [ticketFixture({ status: 'revoked', qr: null })] })));
    render(<TicketScreen orderId="ord_1" />);
    expect(await screen.findByRole('heading', { name: 'Your tickets' })).toBeInTheDocument();
    expect(screen.queryByText(/We've also emailed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to calendar' })).not.toBeInTheDocument();
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

  it('offers an .ics file and Google Calendar in a menu', async () => {
    api(() => json(orderFixture()));
    const user = userEvent.setup();
    render(<TicketScreen orderId="ord_1" />);
    const button = await screen.findByRole('button', { name: 'Add to calendar' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const ics = screen.getByRole('link', { name: 'Apple Calendar or Outlook' });
    expect(ics).toHaveFocus();
    expect(ics).toHaveAttribute('href', 'blob:ics');
    expect(ics).toHaveAttribute('download', 'screen-printing-k7q4.ics');
    const google = screen.getByRole('link', { name: 'Google Calendar' });
    expect(google.getAttribute('href')).toMatch(
      /^https:\/\/calendar\.google\.com\/calendar\/render\?/,
    );
    expect(google).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('button', { name: /wallet/i })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'Google Calendar' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(screen.getByRole('heading', { name: "You're going!" }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('says so when the link has no key or a wrong one', async () => {
    window.location.hash = '';
    const fetch = api(() => json({}, 404));
    const view = render(<TicketScreen orderId="ord_1" />);
    expect(
      await screen.findByRole('heading', { name: "That link doesn't work any more." }),
    ).toBeInTheDocument();
    // Asked with no key, so the answer can tell "no signal" from "no access".
    expect(fetch).toHaveBeenCalledWith('/api/public/orders/ord_1/tickets', {
      headers: {},
      cache: 'no-store',
    });
    view.unmount();

    window.location.hash = `#key=${KEY}`;
    render(<TicketScreen orderId="ord_1" />);
    expect(
      await screen.findByText(
        'Open the latest ticket email from OneTickets and use the link in it.',
      ),
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
      await screen.findByRole('heading', { name: "We couldn't load your tickets." }),
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
    expect(screen.getByRole('status')).toHaveTextContent('Loading your tickets');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    await act(async () => resolve(json(orderFixture())));
    expect(await screen.findByRole('heading', { name: "You're going!" })).toBeInTheDocument();
  });

  it('shows the order checkout just made at once, without reading it again', async () => {
    const fetch = api(() => json(orderFixture()));
    stashConfirmedOrder({ ...orderFixture(), ticketKey: KEY });
    expect(sessionStorage.getItem('onetickets:order:ord_1')).not.toContain(KEY);
    render(<TicketScreen orderId="ord_1" />);
    expect(screen.getByRole('heading', { name: "You're going!" })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('onetickets:order:ord_1')).toBeNull();
  });

  it('reads again until a QR still being signed arrives', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const signing = orderFixture({ tickets: [ticketFixture({ qr: null })] });
      let calls = 0;
      api(() => (++calls < 3 ? json(signing) : json(orderFixture({ tickets: [ticketFixture()] }))));
      render(<TicketScreen orderId="ord_1" />);
      await screen.findByRole('article', { name: 'Your ticket' });
      expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Getting your QR code ready…');
      await act(async () => vi.advanceTimersByTimeAsync(4000));
      expect(
        await screen.findByRole('img', { name: 'QR code for ticket K7Q4-M2XA' }),
      ).toBeInTheDocument();
      expect(calls).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the copy saved on this phone when there is no signal', async () => {
    const order = orderFixture();
    vi.stubGlobal('caches', {
      match: vi.fn(async () => saved(order)),
      open: vi.fn(async () => ({ put: vi.fn(), match: vi.fn(async () => undefined) })),
    });
    api(() => {
      throw new TypeError('Failed to fetch');
    });
    render(<TicketScreen orderId="ord_1" />);
    expect(await screen.findByRole('heading', { name: "You're going!" })).toBeInTheDocument();
    expect(caches.match).toHaveBeenCalledWith('/api/public/orders/ord_1/tickets', {
      cacheName: TICKETS_CACHE,
    });
  });

  it('says the QR is slow, and that it is in the email, when the retries run out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let calls = 0;
      api(() => {
        calls += 1;
        return json(orderFixture({ tickets: [ticketFixture({ qr: null })] }));
      });
      render(<TicketScreen orderId="ord_1" />);
      await screen.findByRole('article', { name: 'Your ticket' });
      await act(async () => vi.advanceTimersByTimeAsync(12000));
      expect(
        await screen.findByText(
          "Your QR code is taking longer than usual. It's in your ticket email too.",
        ),
      ).toBeInTheDocument();
      expect(calls).toBe(6);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('a copy saved on this phone', () => {
    function savedCopy() {
      const deleted = vi.fn(async () => true);
      vi.stubGlobal('caches', {
        match: vi.fn(async () => saved(orderFixture())),
        open: vi.fn(async () => ({ put: vi.fn(), match: vi.fn(), delete: deleted })),
      });
      return deleted;
    }

    it('is not shown, and is dropped, when the api refuses the link', async () => {
      const deleted = savedCopy();
      api(() => json({}, 404));
      render(<TicketScreen orderId="ord_1" />);
      expect(
        await screen.findByRole('heading', { name: "That link doesn't work any more." }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/jordan@example\.test/)).not.toBeInTheDocument();
      expect(caches.match).not.toHaveBeenCalled();
      expect(deleted).toHaveBeenCalledWith('/api/public/orders/ord_1/tickets');
    });

    it('is not shown online without a key, as on a shared phone opened from history', async () => {
      window.location.hash = '';
      const deleted = savedCopy();
      const fetch = api(() => json({}, 404));
      render(<TicketScreen orderId="ord_1" />);
      expect(
        await screen.findByRole('heading', { name: "That link doesn't work any more." }),
      ).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/jordan@example\.test/)).not.toBeInTheDocument();
      expect(caches.match).not.toHaveBeenCalled();
      expect(deleted).not.toHaveBeenCalled();
    });

    it('is shown without a key only when there is no signal', async () => {
      window.location.hash = '';
      savedCopy();
      api(() => {
        throw new TypeError('Failed to fetch');
      });
      render(<TicketScreen orderId="ord_1" />);
      expect(await screen.findByRole('heading', { name: "You're going!" })).toBeInTheDocument();
    });
  });

  it('removes the tickets from this phone after a confirm, and keeps them on screen', async () => {
    const { storage, stores } = fakeCaches();
    vi.stubGlobal('caches', storage);
    const unregister = vi.fn(async () => true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(async () => ({})),
        ready: Promise.resolve({}),
        getRegistrations: async () => [
          { scope: `${location.origin}/tickets/`, unregister },
          { scope: `${location.origin}/other/`, unregister: vi.fn() },
        ],
      },
      configurable: true,
    });
    api(() => json(orderFixture()));
    const user = userEvent.setup();
    render(<TicketScreen orderId="ord_1" />);
    expect(await screen.findByText('Works offline')).toBeInTheDocument();
    expect(stores.get(TICKETS_CACHE)?.has('/api/public/orders/ord_1/tickets')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Remove tickets from this phone' }));
    const group = screen.getByRole('group', {
      name: "Remove these tickets from this phone? They'll still be in your email.",
    });
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(group).not.toBeInTheDocument();
    expect(stores.has(TICKETS_CACHE)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Remove tickets from this phone' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText('Removed from this phone. Your tickets are still in your email.'),
    ).toHaveFocus();
    expect(stores.has(TICKETS_CACHE)).toBe(false);
    expect(sessionStorage.getItem('onetickets:ticket-key:ord_1')).toBeNull();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Works offline')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "You're going!" })).toBeInTheDocument();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });
});
