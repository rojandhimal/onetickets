import type { PublicEventDto } from '@onetickets/shared';

// The attendee's ticket screen (S2-3, artboard 4). Read with the order's ticket key, which arrives
// in the URL fragment (/tickets/{orderId}#key=…) so it never reaches a server log or a Referer.

// ---------- contract ----------
// A typed copy of the orders contract the Claude BackendDev is adding to @onetickets/shared in #58
// (agreed 22 Oct). Once that merges, these types are imported from there instead.

export type TicketStatus = 'valid' | 'revoked';

export interface TicketDto {
  id: string;
  /** 8 Crockford base32 characters, e.g. "K7Q4M2XA"; shown as "K7Q4-M2XA". */
  ref: string;
  holderName: string;
  ticketTypeName: string;
  /**
   * The signed QR token (ADR 0011), drawn here as a QR code. No name or email. Null for a moment
   * after the order while it's being signed, and for a revoked ticket.
   */
  qr: string | null;
  status: TicketStatus;
  issuedAt: string;
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

/** The order and ticket key from `POST /public/orders` (S2-2 checkout). */
export interface CreatedOrderDto extends OrderTicketsDto {
  ticketKey: string;
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

const keySlot = (orderId: string) => `onetickets:ticket-key:${orderId}`;
const orderSlot = (orderId: string) => `onetickets:order:${orderId}`;

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The key for this order. A key in the fragment is taken out of the address bar at once (as sign-in
 * links are, ADR 0001) and kept for this tab only, so a reload can still read the order. Never in
 * localStorage, Cache Storage or a query string.
 */
export function takeTicketKey(orderId: string): string | null {
  const fromLink = ticketKeyFromHash(window.location.hash);
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  try {
    if (fromLink) session()?.setItem(keySlot(orderId), fromLink);
    return fromLink ?? session()?.getItem(keySlot(orderId)) ?? null;
  } catch {
    return fromLink;
  }
}

/**
 * Checkout calls this with the created order just before `location.assign(confirmationPath(…))`,
 * so the confirmation shows at once without reading the order again. The key isn't kept with it.
 */
export function stashConfirmedOrder(created: CreatedOrderDto): void {
  const order: OrderTicketsDto & { ticketKey?: string } = { ...created };
  delete order.ticketKey;
  try {
    session()?.setItem(orderSlot(order.orderId), JSON.stringify(order));
  } catch {
    // Private mode or full storage: the page reads the order with the key instead.
  }
}

/** The order checkout just stashed for this page, once. */
export function takeConfirmedOrder(orderId: string): OrderTicketsDto | null {
  try {
    const raw = session()?.getItem(orderSlot(orderId));
    session()?.removeItem(orderSlot(orderId));
    const order = raw ? (JSON.parse(raw) as OrderTicketsDto) : null;
    return order?.orderId === orderId ? order : null;
  } catch {
    return null;
  }
}

/** "K7Q4M2XA" → "K7Q4-M2XA", easier to read out at the door. */
export function formatRef(ref: string): string {
  return /^[0-9A-Z]{8}$/.test(ref) ? `${ref.slice(0, 4)}-${ref.slice(4)}` : ref;
}

/** True while some ticket still waits for its signed QR (just after the order). */
export function awaitingQr(order: OrderTicketsDto): boolean {
  return order.tickets.some((t) => t.status === 'valid' && !t.qr);
}

export type OrderTicketsResult =
  { ok: true; order: OrderTicketsDto } | { ok: false; kind: 'not-found' | 'offline' | 'failed' };

/**
 * Reads the order. With no key it still asks, so the answer says whether there's signal: the api
 * refuses it, and only a failed request lets the page fall back to a saved copy.
 */
export async function fetchOrderTickets(
  orderId: string,
  key: string | null,
): Promise<OrderTicketsResult> {
  let res: Response;
  try {
    res = await fetch(orderTicketsPath(orderId), {
      headers: key ? { authorization: `Bearer ${key}` } : {},
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

/** This order as saved on the device by an earlier visit, or null. */
export async function readSavedOrder(orderId: string): Promise<OrderTicketsDto | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const res = await caches.match(orderTicketsPath(orderId), { cacheName: TICKETS_CACHE });
    return res ? ((await res.json()) as OrderTicketsDto) : null;
  } catch {
    return null;
  }
}

/** Drops this order's saved copy, once the api says the link no longer opens it. */
export async function forgetSavedOrder(orderId: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(TICKETS_CACHE);
    await cache.delete(orderTicketsPath(orderId));
  } catch {
    // Nothing saved, or storage blocked.
  }
}

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

/** The stub's venue line. */
export function venueLine(venue: CalendarEvent['venue']): string {
  return venue.kind === 'online'
    ? 'Online · the link is in your email'
    : `${venue.name}, ${venue.address}`;
}

function calendarLocation(venue: CalendarEvent['venue']): string {
  return venue.kind === 'online' ? 'Online' : `${venue.name}, ${venue.address}`;
}

/** The public event page and a pointer to the email. Never the ticket page: it opens the tickets. */
function calendarDescription(event: CalendarEvent, origin: string): string {
  return `${origin}/e/${event.slug}\nYour tickets are in your email from OneTickets.`;
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
    `LOCATION:${icsText(calendarLocation(event.venue))}`,
    `DESCRIPTION:${icsText(calendarDescription(event, origin))}`,
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
    location: calendarLocation(event.venue),
    details: calendarDescription(event, origin),
    ctz: event.timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
