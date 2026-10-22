import type { PublicEventDto } from '@onetickets/shared';

// The attendee's ticket screen (S2-3, artboard 4). Read with the order's ticket key, which arrives
// in the URL fragment (/tickets/{orderId}#key=…) so it never reaches a server log or a Referer.

// ---------- contract ----------
// A typed stub of the tickets read the Claude BackendDev is building (proposed 22 Oct). Once it
// lands in @onetickets/shared, these types are imported from there instead.

export type TicketStatus = 'valid' | 'released' | 'checked_in';

export interface TicketDto {
  id: string;
  /** Short reference printed on the stub, e.g. "7K4Q-2M9X". */
  ref: string;
  holderName: string;
  ticketTypeName: string;
  /** The signed QR token (ADR 0011). No name or email; the web draws it as a QR code. */
  qr: string;
  status: TicketStatus;
}

export interface OrderTicketsDto {
  orderId: string;
  /** Where the tickets were emailed. */
  email: string;
  event: Pick<
    PublicEventDto,
    'slug' | 'name' | 'startsAt' | 'endsAt' | 'timeZone' | 'venue' | 'organiser'
  >;
  tickets: TicketDto[];
}

/** GET with `Authorization: Bearer <ticket key>`; a wrong id or key is the same 404. */
export const orderTicketsPath = (orderId: string) =>
  `/api/public/orders/${encodeURIComponent(orderId)}/tickets`;

// ---------- reading ----------

/** The ticket key from `#key=…`, or null. */
export function ticketKeyFromHash(hash: string): string | null {
  const key = new URLSearchParams(hash.replace(/^#/, '')).get('key');
  return key && /^[A-Za-z0-9_-]{16,200}$/.test(key) ? key : null;
}

export type OrderTicketsResult =
  { ok: true; order: OrderTicketsDto } | { ok: false; kind: 'not-found' | 'offline' | 'failed' };

export async function fetchOrderTickets(orderId: string, key: string): Promise<OrderTicketsResult> {
  let res: Response;
  try {
    res = await fetch(orderTicketsPath(orderId), {
      headers: { authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, kind: 'offline' };
  }
  if (res.status === 404 || res.status === 401 || res.status === 403) {
    return { ok: false, kind: 'not-found' };
  }
  if (!res.ok) return { ok: false, kind: 'failed' };
  const order = (await res.json().catch(() => null)) as OrderTicketsDto | null;
  return order ? { ok: true, order } : { ok: false, kind: 'failed' };
}

// ---------- offline ----------

/** Cache Storage name shared with public/tickets-sw.js; bump both together. */
export const TICKETS_CACHE = 'onetickets-tickets-v1';
export const TICKETS_SW = '/tickets-sw.js';

/**
 * Keeps this order's tickets, this page and the scripts, styles and fonts it loaded in the
 * device's Cache Storage, where the service worker serves them when there's no signal. The
 * attendee's own device only; nothing here is shared with anyone else. True once all of it is in.
 */
export async function saveForOffline(order: OrderTicketsDto): Promise<boolean> {
  if (typeof caches === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.ready;
    const cache = await caches.open(TICKETS_CACHE);
    await cache.put(
      orderTicketsPath(order.orderId),
      new Response(JSON.stringify(order), { headers: { 'content-type': 'application/json' } }),
    );
    const assets = performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name))
      .filter((url) => url.origin === location.origin && url.pathname.startsWith('/_next/static/'))
      .map((url) => url.href);
    const saved = await Promise.all(
      [location.pathname, ...new Set(assets)].map(async (url) => {
        const res = await fetch(url, { credentials: 'same-origin' }).catch(() => null);
        if (res?.ok) {
          await cache.put(url, res);
          return true;
        }
        // Offline, an earlier visit's copy still counts.
        return !!(await cache.match(url));
      }),
    );
    return saved.every(Boolean);
  } catch {
    return false;
  }
}

// ---------- calendar ----------

type CalendarEvent = OrderTicketsDto['event'];

export function placeText(venue: CalendarEvent['venue']): string {
  return venue.kind === 'online' ? 'Online event' : `${venue.name}, ${venue.address}`;
}

/** 20261113T230000Z */
function utcStamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 folds lines over 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** An .ics file for Apple Calendar, Outlook and the rest. */
export function icsFile(event: CalendarEvent, origin: string, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OneTickets//Tickets//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.slug}@onetickets`,
    `DTSTAMP:${utcStamp(now.toISOString())}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(event.endsAt)}`,
    `SUMMARY:${icsText(event.name)}`,
    `LOCATION:${icsText(placeText(event.venue))}`,
    `URL:${origin}/e/${event.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(event: CalendarEvent, origin: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${utcStamp(event.startsAt)}/${utcStamp(event.endsAt)}`,
    location: placeText(event.venue),
    details: `${origin}/e/${event.slug}`,
    ctz: event.timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
