'use client';

import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { QrCode } from '@/components/QrCode';
import {
  type OrderTicketsDto,
  TICKETS_SW,
  type TicketDto,
  awaitingQr,
  dropExpiredOrders,
  fetchOrderTickets,
  forgetSavedOrder,
  formatRef,
  googleCalendarUrl,
  icsFile,
  readSavedOrder,
  removeFromDevice,
  saveForOffline,
  takeConfirmedOrder,
  takeTicketKey,
  venueLine,
} from '@/lib/tickets';
import { eventEyebrow } from '@/lib/zoned-time';
import styles from './tickets.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; order: OrderTicketsDto }
  | { kind: 'not-found' | 'offline' };

/** Tries for a QR still being signed, a couple of seconds apart. */
const QR_RETRIES = 5;

/** Artboard 4: "You're going!", then one ticket stub at a time. */
export function TicketScreen({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [offlineReady, setOfflineReady] = useState(false);
  const [qrSlow, setQrSlow] = useState(false);
  const key = useRef<string | null>(null);
  // Once removed, this visit doesn't save the order again.
  const removed = useRef(false);

  useEffect(() => {
    // Only ticket pages: the worker's scope stops it touching the rest of the site.
    navigator.serviceWorker?.register(TICKETS_SW, { scope: '/tickets/' }).catch(() => undefined);
    void dropExpiredOrders();
  }, []);

  const show = useCallback(async (order: OrderTicketsDto, cancelled: () => boolean) => {
    setState({ kind: 'ready', order });
    if (awaitingQr(order) || removed.current) return;
    const saved = await saveForOffline(order);
    if (!cancelled() && !removed.current) setOfflineReady(saved);
  }, []);

  const load = useCallback(
    async (cancelled: () => boolean) => {
      const result = await fetchOrderTickets(orderId, key.current);
      if (cancelled()) return;
      if (result.ok) return show(result.order, cancelled);
      if (result.kind === 'not-found') {
        // The api answered: a revoked or expired link, or no key. Never the saved copy then, and a
        // keyed refusal drops it so this phone stops holding the tickets.
        if (key.current) await forgetSavedOrder(orderId);
        if (!cancelled()) setState({ kind: 'not-found' });
        return;
      }
      // No signal (or the api is down): a copy saved by an earlier visit beats an error at the door.
      const saved = await readSavedOrder(orderId);
      if (cancelled()) return;
      if (saved) return show(saved, cancelled);
      setState({ kind: 'offline' });
    },
    [orderId, show],
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    key.current = takeTicketKey(orderId);
    const confirmed = takeConfirmedOrder(orderId);
    void (confirmed ? show(confirmed, isCancelled) : load(isCancelled));
    return () => {
      cancelled = true;
    };
  }, [orderId, load, show]);

  // Straight after the order, QRs are signed a moment later: read again until they're all there.
  const pending = state.kind === 'ready' && awaitingQr(state.order);
  useEffect(() => {
    if (!pending || !key.current) return;
    const ticketKey = key.current;
    let cancelled = false;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const last = tries >= QR_RETRIES;
      if (last) window.clearInterval(timer);
      void fetchOrderTickets(orderId, ticketKey).then((result) => {
        if (cancelled) return;
        // A failed retry keeps the stubs on screen; only a fuller order replaces them.
        if (result.ok) void show(result.order, () => cancelled);
        if (last && (!result.ok || awaitingQr(result.order))) setQrSlow(true);
      });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pending, orderId, show]);

  if (state.kind === 'loading') return <Loading />;

  if (state.kind !== 'ready') {
    const offline = state.kind === 'offline';
    return (
      <Shell>
        <div className={styles.messageCard}>
          <h1 className={styles.messageTitle}>
            {offline ? "We couldn't load your tickets." : "That link doesn't work any more."}
          </h1>
          <p>
            {offline
              ? 'Check your connection and try again. Your tickets are also in your email.'
              : 'Open the latest ticket email from OneTickets and use the link in it.'}
          </p>
          {offline && (
            <button
              type="button"
              className={styles.darkButton}
              onClick={() => {
                setState({ kind: 'loading' });
                void load(() => false);
              }}
            >
              Try again
            </button>
          )}
        </div>
        <a href="/" className={styles.moreLink}>
          Find more events
        </a>
      </Shell>
    );
  }

  const { order } = state;
  const many = order.tickets.length > 1;
  const allRevoked = order.tickets.every((t) => t.status === 'revoked');
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
        <h1 className={styles.heading}>{allRevoked ? 'Your tickets' : "You're going!"}</h1>
        {!allRevoked && (
          <p className={styles.lede}>
            We&apos;ve also emailed your {many ? 'tickets' : 'ticket'} to {order.email}
          </p>
        )}
      </div>
      <TicketPager order={order} qrSlow={qrSlow} />
      {!allRevoked && <AddToCalendar event={order.event} />}
      <a href="/" className={styles.moreLink}>
        Find more events
      </a>
      <RemoveFromDevice
        onRemove={async () => {
          removed.current = true;
          setOfflineReady(false);
          await removeFromDevice(orderId);
        }}
      />
    </Shell>
  );
}

/**
 * Takes this order off the phone (ADR 0020): a quiet button, then an inline confirm. The tickets
 * stay on screen until the page is left, and stay in the email.
 */
function RemoveFromDevice({ onRemove }: { onRemove: () => Promise<void> }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'failed'>('idle');
  const start = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (step === 'confirm') confirm.current?.focus();
    if (step === 'done' || step === 'failed') status.current?.focus();
  }, [step]);

  if (step === 'done' || step === 'failed') {
    return (
      <p ref={status} tabIndex={-1} role="status" className={styles.removeNote}>
        {step === 'done'
          ? 'Removed from this phone. Your tickets are still in your email.'
          : "We couldn't remove them. Clear this site's data in your browser settings instead."}
      </p>
    );
  }

  if (step === 'idle') {
    return (
      <button
        ref={start}
        type="button"
        className={styles.removeButton}
        onClick={() => setStep('confirm')}
      >
        Remove tickets from this phone
      </button>
    );
  }

  return (
    <div className={styles.removeConfirm} role="group" aria-labelledby="remove-question">
      <p id="remove-question">
        Remove these tickets from this phone? They&apos;ll still be in your email.
      </p>
      <div className={styles.removeActions}>
        <button
          ref={confirm}
          type="button"
          className={styles.darkButton}
          aria-disabled={step === 'busy' || undefined}
          onClick={async () => {
            if (step === 'busy') return;
            setStep('busy');
            try {
              await onRemove();
              setStep('done');
            } catch {
              setStep('failed');
            }
          }}
        >
          Remove
        </button>
        <button
          type="button"
          className={styles.keepButton}
          onClick={() => {
            setStep('idle');
            requestAnimationFrame(() => start.current?.focus());
          }}
        >
          Keep
        </button>
      </div>
    </div>
  );
}

function Shell({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <div className={styles.page}>
      <main className={styles.main} aria-busy={busy || undefined}>
        {children}
      </main>
    </div>
  );
}

/** Opened from a link: a grey stub until the order arrives. No spinner. */
function Loading() {
  return (
    <Shell busy>
      <p className="visually-hidden" role="status">
        Loading your tickets
      </p>
      <div className={styles.topRow} />
      <div className={styles.intro} aria-hidden="true">
        <span className={`${styles.bone} ${styles.boneHeading}`} />
        <span className={`${styles.bone} ${styles.boneLede}`} />
      </div>
      <div className={`${styles.stub} ${styles.skeleton}`} aria-hidden="true">
        <div className={styles.stubHead}>
          <span className={`${styles.bone} ${styles.boneShort}`} />
          <span className={`${styles.bone} ${styles.boneLong}`} />
          <span className={`${styles.bone} ${styles.boneMid}`} />
        </div>
        <div className={styles.perforation} />
        <div className={styles.stubBody}>
          <span className={`${styles.bone} ${styles.boneQr}`} />
        </div>
      </div>
    </Shell>
  );
}

/** One stub at a time; Previous and Next, or a sideways swipe on a touch screen. */
function TicketPager({ order, qrSlow }: { order: OrderTicketsDto; qrSlow: boolean }) {
  const [index, setIndex] = useState(0);
  const count = order.tickets.length;
  const ticket = order.tickets[Math.min(index, count - 1)];
  const start = useRef<{ x: number; y: number } | null>(null);

  useWakeLock(order.tickets.some((t) => !!t.qr));

  if (!ticket) return null;
  const many = count > 1;
  const atFirst = index === 0;
  const atLast = index === count - 1;
  const move = (by: number) => setIndex((i) => Math.min(count - 1, Math.max(0, i + by)));

  function onPointerDown(e: PointerEvent) {
    start.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
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
        aria-label={many ? `Ticket ${index + 1} of ${count}` : 'Your ticket'}
        className={styles.stub}
        onPointerDown={many ? onPointerDown : undefined}
        onPointerUp={many ? onPointerUp : undefined}
        onPointerCancel={() => (start.current = null)}
      >
        <div className={styles.stubHead}>
          <span className={styles.eyebrow}>
            {eventEyebrow(order.event.startsAt, order.event.timeZone)}
          </span>
          <span className={styles.eventName}>{order.event.name}</span>
          <span className={styles.place}>{venueLine(order.event.venue)}</span>
        </div>
        <div className={styles.perforation} aria-hidden="true" />
        <Stub ticket={ticket} organiser={order.event.organiser.name} qrSlow={qrSlow} />
      </article>

      {many && (
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

function Stub({
  ticket,
  organiser,
  qrSlow,
}: {
  ticket: TicketDto;
  organiser: string;
  qrSlow: boolean;
}) {
  const ref = formatRef(ticket.ref);
  const revoked = ticket.status === 'revoked';
  return (
    <div className={styles.stubBody}>
      {revoked ? (
        <p className={styles.noQr}>
          <strong>This ticket is no longer valid.</strong> It was released or cancelled, so
          there&apos;s no QR to show. Questions? Reply to your ticket email to reach {organiser}.
        </p>
      ) : ticket.qr ? (
        <div className={styles.qr}>
          <QrCode value={ticket.qr} label={`QR code for ticket ${ref}`} />
        </div>
      ) : (
        <div className={`${styles.qr} ${styles.qrPending}`}>
          <p role="status">
            {qrSlow
              ? "Your QR code is taking longer than usual. It's in your ticket email too."
              : 'Getting your QR code ready…'}
          </p>
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
          <dd>{ref}</dd>
        </div>
      </dl>
      {!revoked && (
        <p className={styles.note}>
          Turn your screen brightness up at the door so it scans first time.
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
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
      else void lock?.release().catch(() => undefined);
    };
    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/**
 * A menu of an .ics file (Apple Calendar, Outlook) and Google Calendar: a bottom sheet on phones,
 * a popover from 640 px. Esc or a tap outside closes it and focus goes back to the button.
 */
function AddToCalendar({ event }: { event: OrderTicketsDto['event'] }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<{ ics: string; google: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const ics = URL.createObjectURL(
      new Blob([icsFile(event, origin)], { type: 'text/calendar;charset=utf-8' }),
    );
    setLinks({ ics, google: googleCalendarUrl(event, origin) });
    return () => URL.revokeObjectURL(ics);
  }, [event]);

  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // On click rather than pointerdown, so the focus a tap gives the page comes after, not over,
    // the move back to the button.
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [open, close]);

  return (
    <div className={styles.calendar}>
      <button
        ref={button}
        type="button"
        className={styles.lightButton}
        aria-expanded={open}
        aria-controls="calendar-options"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name="calendar" size={18} />
        Add to calendar
      </button>
      {open && links && (
        <>
          <div className={styles.scrim} aria-hidden="true" />
          <div ref={menu} id="calendar-options" className={styles.calendarMenu}>
            <ul>
              <li>
                <a href={links.ics} download={`${event.slug}.ics`} onClick={() => setOpen(false)}>
                  Apple Calendar or Outlook
                </a>
              </li>
              <li>
                <a
                  href={links.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  Google Calendar
                </a>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
