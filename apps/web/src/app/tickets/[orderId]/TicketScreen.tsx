'use client';

import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { QrCode } from '@/components/QrCode';
import {
  type OrderTicketsDto,
  TICKETS_SW,
  type TicketDto,
  fetchOrderTickets,
  googleCalendarUrl,
  icsFile,
  placeText,
  saveForOffline,
  ticketKeyFromHash,
} from '@/lib/tickets';
import { eventEyebrow } from '@/lib/zoned-time';
import styles from './tickets.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; order: OrderTicketsDto }
  | { kind: 'not-found' | 'offline' | 'failed' };

/** Artboard 4: "You're going!", then one ticket stub at a time. */
export function TicketScreen({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [offlineReady, setOfflineReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Only ticket pages: the worker's scope stops it touching the rest of the site.
    navigator.serviceWorker?.register(TICKETS_SW, { scope: '/tickets/' }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const key = ticketKeyFromHash(window.location.hash);
    void (async () => {
      const result = key
        ? await fetchOrderTickets(orderId, key)
        : ({ ok: false, kind: 'not-found' } as const);
      if (cancelled) return;
      if (!result.ok) {
        setState({ kind: result.kind });
        return;
      }
      setState({ kind: 'ready', order: result.order });
      const saved = await saveForOffline(result.order);
      if (!cancelled) setOfflineReady(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  if (state.kind === 'loading') {
    return (
      <Shell>
        <p role="status" className={styles.lede}>
          Loading your tickets…
        </p>
      </Shell>
    );
  }

  if (state.kind !== 'ready') {
    const notFound = state.kind === 'not-found';
    return (
      <Shell>
        <div className={styles.intro}>
          <h1 className={styles.heading}>
            {notFound ? "We couldn't find these tickets" : "We couldn't load your tickets"}
          </h1>
          <p className={styles.lede}>
            {notFound
              ? 'Open the link in your confirmation email to see them.'
              : state.kind === 'offline'
                ? "We couldn't reach OneTickets. Check your connection and try again."
                : 'Something went wrong on our side. Try again in a moment.'}
          </p>
        </div>
        {!notFound && (
          <button
            type="button"
            className={styles.lightButton}
            onClick={() => {
              setState({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        )}
        <a href="/" className={styles.moreLink}>
          Find more events
        </a>
      </Shell>
    );
  }

  const { order } = state;
  const many = order.tickets.length !== 1;
  return (
    <Shell>
      <div className={styles.topRow}>
        {offlineReady && (
          <span className={styles.offlineChip}>
            <Icon name="check" size={14} />
            Works offline
          </span>
        )}
      </div>
      <div className={styles.intro}>
        <h1 className={styles.heading}>You&apos;re going!</h1>
        <p className={styles.lede}>
          We&apos;ve also emailed your {many ? 'tickets' : 'ticket'} to {order.email}
        </p>
      </div>
      <TicketPager order={order} />
      <AddToCalendar event={order.event} />
      <a href="/" className={styles.moreLink}>
        Find more events
      </a>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

/** One stub at a time; Previous and Next, or a swipe, move between them. */
function TicketPager({ order }: { order: OrderTicketsDto }) {
  const [index, setIndex] = useState(0);
  const count = order.tickets.length;
  const ticket = order.tickets[Math.min(index, count - 1)];
  const start = useRef<{ x: number; y: number } | null>(null);

  useWakeLock(order.tickets.some((t) => t.status !== 'released'));

  if (!ticket) return null;
  const atFirst = index === 0;
  const atLast = index === count - 1;
  const move = (by: number) => setIndex((i) => Math.min(count - 1, Math.max(0, i + by)));

  function onPointerDown(e: PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: PointerEvent) {
    const from = start.current;
    start.current = null;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    move(dx < 0 ? 1 : -1);
  }

  return (
    <>
      <article
        aria-label={`Ticket ${index + 1} of ${count}`}
        className={styles.stub}
        onPointerDown={count > 1 ? onPointerDown : undefined}
        onPointerUp={count > 1 ? onPointerUp : undefined}
        onPointerCancel={() => (start.current = null)}
      >
        <div className={styles.stubHead}>
          <span className={styles.eyebrow}>
            {eventEyebrow(order.event.startsAt, order.event.timeZone)}
          </span>
          <span className={styles.eventName}>{order.event.name}</span>
          <span className={styles.place}>{placeText(order.event.venue)}</span>
        </div>
        <div className={styles.perforation} aria-hidden="true" />
        <Stub ticket={ticket} />
      </article>

      {count > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pageButton}
            aria-label="Previous ticket"
            aria-disabled={atFirst || undefined}
            onClick={() => move(-1)}
          >
            <Icon name="back" size={22} />
          </button>
          <span aria-live="polite" className={styles.position}>
            Ticket {index + 1} of {count}
          </span>
          <button
            type="button"
            className={styles.pageButton}
            aria-label="Next ticket"
            aria-disabled={atLast || undefined}
            onClick={() => move(1)}
          >
            <Icon name="chevron" size={22} />
          </button>
        </div>
      )}
    </>
  );
}

function Stub({ ticket }: { ticket: TicketDto }) {
  return (
    <div className={styles.stubBody}>
      {ticket.status === 'released' ? (
        <p className={styles.released}>Released. This QR no longer works.</p>
      ) : (
        <div className={styles.qr}>
          <QrCode value={ticket.qr} label={`QR code for ticket ${ticket.ref}`} />
        </div>
      )}
      <dl className={styles.facts}>
        <div>
          <dt>Name</dt>
          <dd>{ticket.holderName}</dd>
        </div>
        <div>
          <dt>Ticket</dt>
          <dd>{ticket.ticketTypeName}</dd>
        </div>
        <div>
          <dt>Ref</dt>
          <dd>{ticket.ref}</dd>
        </div>
      </dl>
      {ticket.status !== 'released' && (
        <p className={styles.note}>
          Screen brightness goes up while this is open so the door can scan it.
        </p>
      )}
    </div>
  );
}

/**
 * Keeps the screen on while a QR is showing, where the browser allows (Screen Wake Lock). The
 * browser drops the lock when the tab is hidden, so it's asked for again on return.
 */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const request = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (done) void next.release().catch(() => undefined);
        else lock = next;
      } catch {
        // Battery saver or a denied permission: the full-white card still helps the scan.
      }
    };
    const onVisibility = () => void request();
    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/** An .ics file for Apple Calendar, Outlook and the rest, or Google Calendar on the web. */
function AddToCalendar({ event }: { event: OrderTicketsDto['event'] }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<{ ics: string; google: string } | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const ics = URL.createObjectURL(
      new Blob([icsFile(event, origin)], { type: 'text/calendar;charset=utf-8' }),
    );
    setLinks({ ics, google: googleCalendarUrl(event, origin) });
    return () => URL.revokeObjectURL(ics);
  }, [event]);

  return (
    <div className={styles.calendar}>
      <button
        type="button"
        className={styles.lightButton}
        aria-expanded={open}
        aria-controls="calendar-options"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" size={18} />
        Add to calendar
      </button>
      {open && links && (
        <ul id="calendar-options" className={styles.calendarOptions}>
          <li>
            <a href={links.ics} download={`${event.slug}.ics`}>
              Apple, Outlook and others (.ics)
            </a>
          </li>
          <li>
            <a href={links.google} target="_blank" rel="noopener noreferrer">
              Google Calendar
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}
