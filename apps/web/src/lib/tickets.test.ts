import { describe, expect, it } from 'vitest';
import { qrPath } from '@/components/QrCode';
import { orderFixture } from '@/test/order-fixture';
import { googleCalendarUrl, icsFile, placeText, ticketKeyFromHash } from './tickets';

const event = orderFixture().event;

describe('ticket links', () => {
  it('reads the key from the fragment and ignores anything that is not one', () => {
    expect(ticketKeyFromHash('#key=abcdEFGH1234_-xyz')).toBe('abcdEFGH1234_-xyz');
    expect(ticketKeyFromHash('')).toBeNull();
    expect(ticketKeyFromHash('#key=short')).toBeNull();
    expect(ticketKeyFromHash('#key=<script>alert(1)</script>')).toBeNull();
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
      'URL:https://onetickets.example.test/e/screen-printing-k7q4',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('folds long lines at 75 octets', () => {
    const ics = icsFile({ ...event, name: 'Ü'.repeat(60) }, 'https://x.test');
    const summary = ics.split('\r\n').filter((l) => l.startsWith('SUMMARY') || l.startsWith(' '));
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
      details: 'https://x.test/e/screen-printing-k7q4',
      ctz: 'Australia/Sydney',
    });
    expect(placeText({ kind: 'online' })).toBe('Online event');
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
