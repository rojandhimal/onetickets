import { afterEach, describe, expect, it, vi } from 'vitest';
import { qrPath } from '@/components/QrCode';
import { fakeCaches } from '@/test/fake-caches';
import { orderFixture } from '@/test/order-fixture';
import {
  EXPIRES_HEADER,
  TICKETS_CACHE,
  dropExpiredOrders,
  formatRef,
  googleCalendarUrl,
  icsFile,
  readSavedOrder,
  removeFromDevice,
  savedUntil,
  stashConfirmedOrder,
  takeConfirmedOrder,
  takeTicketKey,
  ticketKeyFromHash,
  venueLine,
} from './tickets';

const event = orderFixture().event;
const FAKE_KEY = 'abcdEFGH1234_-xyz'; // gitleaks:allow (fake ticket key)

describe('ticket links', () => {
  it('reads the key from the fragment and ignores anything that is not one', () => {
    expect(ticketKeyFromHash(`#key=${FAKE_KEY}`)).toBe(FAKE_KEY);
    expect(ticketKeyFromHash('')).toBeNull();
    expect(ticketKeyFromHash('#key=short')).toBeNull();
    expect(ticketKeyFromHash('#key=<script>alert(1)</script>')).toBeNull();
  });

  it('takes the key out of the address bar and keeps it for this tab only', () => {
    window.history.replaceState(null, '', `/tickets/ord_1#key=${FAKE_KEY}`);
    expect(takeTicketKey('ord_1')).toBe(FAKE_KEY);
    expect(window.location.href).toBe(`${window.location.origin}/tickets/ord_1`);
    expect(window.localStorage.length).toBe(0);
    // A reload in the same tab still has it; another order doesn't.
    expect(takeTicketKey('ord_1')).toBe(FAKE_KEY);
    expect(takeTicketKey('ord_2')).toBeNull();
    window.sessionStorage.clear();
  });

  it('hands the created order from checkout to the page once, without its key', () => {
    stashConfirmedOrder({ ...orderFixture(), ticketKey: 'secret-ticket-key-123' });
    expect(window.sessionStorage.getItem('onetickets:order:ord_1')).not.toContain('secret');
    expect(takeConfirmedOrder('ord_2')).toBeNull();
    expect(takeConfirmedOrder('ord_1')).toEqual(orderFixture());
    expect(takeConfirmedOrder('ord_1')).toBeNull();
  });

  it('shows refs in two halves', () => {
    expect(formatRef('K7Q4M2XA')).toBe('K7Q4-M2XA');
    expect(formatRef('odd-ref')).toBe('odd-ref');
  });
});

describe('add to calendar', () => {
  it('writes an .ics file with UTC times, escaped text and CRLF lines', () => {
    const ics = icsFile(
      { ...event, name: 'Screen printing; inks, aprons' },
      'https://onetickets.example.test',
      new Date('2026-10-22T00:00:00Z'),
    );
    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OneTickets//Tickets//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:screen-printing-k7q4@onetickets',
      'DTSTAMP:20261022T000000Z',
      'DTSTART:20261113T230000Z',
      'DTEND:20261114T020000Z',
      'SUMMARY:Screen printing\\; inks\\, aprons',
      'LOCATION:The Print Shed\\, 12 Sydenham Rd\\, Marrickville NSW 2204',
      'DESCRIPTION:https://onetickets.example.test/e/screen-printing-k7q4\\nYour ti',
      ' ckets are in your email from OneTickets.',
      'URL:https://onetickets.example.test/e/screen-printing-k7q4',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('never puts the ticket page in the calendar', () => {
    const ics = icsFile(event, 'https://x.test');
    expect(ics).not.toContain('/tickets/');
    expect(googleCalendarUrl(event, 'https://x.test')).not.toContain('tickets%2F');
  });

  it('folds long lines at 75 octets', () => {
    const ics = icsFile({ ...event, name: 'Ü'.repeat(60) }, 'https://x.test');
    const lines = ics.split('\r\n');
    const start = lines.findIndex((l) => l.startsWith('SUMMARY:'));
    const end = lines.findIndex((l, i) => i > start && !l.startsWith(' '));
    const summary = lines.slice(start, end);
    expect(summary.length).toBeGreaterThan(1);
    for (const line of summary)
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(summary.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(`SUMMARY:${'Ü'.repeat(60)}`);
  });

  it('links to Google Calendar with the same details', () => {
    const url = new URL(googleCalendarUrl(event, 'https://x.test'));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'Screen printing for beginners',
      dates: '20261113T230000Z/20261114T020000Z',
      location: 'The Print Shed, 12 Sydenham Rd, Marrickville NSW 2204',
      details:
        'https://x.test/e/screen-printing-k7q4\nYour tickets are in your email from OneTickets.',
      ctz: 'Australia/Sydney',
    });
    expect(venueLine({ kind: 'online' })).toBe('Online · the link is in your email');
    expect(
      new URL(
        googleCalendarUrl({ ...event, venue: { kind: 'online' } }, 'https://x.test'),
      ).searchParams.get('location'),
    ).toBe('Online');
  });
});

describe('QR code', () => {
  it('draws the token with a four-module quiet zone', () => {
    const { size, d } = qrPath('OT1.k1.evt_1.tkt_1');
    // Version 2 at level M holds this token: 25 modules plus 4 each side.
    expect(size).toBe(33);
    // The top-left finder pattern starts at the quiet zone's edge.
    expect(d.startsWith('M4 4h1v1h-1z')).toBe(true);
  });
});

describe('tickets saved on this device', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function saveOrders(entries: Record<string, string | null>) {
    const fake = fakeCaches();
    vi.stubGlobal('caches', fake.storage);
    const cache = await fake.storage.open(TICKETS_CACHE);
    for (const [orderId, expires] of Object.entries(entries)) {
      const headers: Record<string, string> = expires ? { [EXPIRES_HEADER]: expires } : {};
      await cache.put(
        `/api/public/orders/${orderId}/tickets`,
        new Response(JSON.stringify(orderFixture({ orderId })), { headers }),
      );
      await cache.put(`/tickets/${orderId}`, new Response('<html></html>'));
    }
    await cache.put('/_next/static/chunks/app.js', new Response(''));
    return fake.stores;
  }

  it('keeps a saved order until 7 days after the event ends', () => {
    expect(savedUntil({ endsAt: '2026-11-14T13:00:00+11:00' }).toISOString()).toBe(
      '2026-11-21T02:00:00.000Z',
    );
  });

  it('drops orders past their date, and anything with no date, but keeps the rest', async () => {
    const stores = await saveOrders({
      old: '2026-10-01T00:00:00.000Z',
      undated: null,
      soon: '2026-12-01T00:00:00.000Z',
    });
    await dropExpiredOrders(new Date('2026-10-23T00:00:00Z'));
    expect([...stores.get(TICKETS_CACHE)!.keys()].sort()).toEqual([
      '/_next/static/chunks/app.js',
      '/api/public/orders/soon/tickets',
      '/tickets/soon',
    ]);
  });

  it('clears the cache when the last saved order expires', async () => {
    const stores = await saveOrders({ old: '2026-10-01T00:00:00.000Z' });
    await dropExpiredOrders(new Date('2026-10-23T00:00:00Z'));
    expect(stores.has(TICKETS_CACHE)).toBe(false);
  });

  it('never reads a copy past its date', async () => {
    await saveOrders({ old: '2000-01-01T00:00:00.000Z', soon: '2099-01-01T00:00:00.000Z' });
    expect(await readSavedOrder('old')).toBeNull();
    expect((await readSavedOrder('soon'))?.orderId).toBe('soon');
  });

  it('removes one order and keeps the others and the built files', async () => {
    const stores = await saveOrders({
      a: '2099-01-01T00:00:00.000Z',
      b: '2099-01-01T00:00:00.000Z',
    });
    sessionStorage.setItem('onetickets:ticket-key:a', FAKE_KEY);
    await removeFromDevice('a');
    expect(sessionStorage.getItem('onetickets:ticket-key:a')).toBeNull();
    expect([...stores.get(TICKETS_CACHE)!.keys()].sort()).toEqual([
      '/_next/static/chunks/app.js',
      '/api/public/orders/b/tickets',
      '/tickets/b',
    ]);
    await removeFromDevice('b');
    expect(stores.has(TICKETS_CACHE)).toBe(false);
  });
});
