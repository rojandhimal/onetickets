'use client';

import type { AttendeeSession, OrderTicketsDto } from '@onetickets/shared';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import {
  fetchAttendeeOrders,
  fetchAttendeeSession,
  requestAttendeeLink,
  signOutAttendee,
  splitOrders,
} from '@/lib/attendee';
import { venueLine } from '@/lib/tickets';
import { eventEyebrow } from '@/lib/zoned-time';
import styles from './my-tickets.module.css';

type Tab = 'upcoming' | 'past';

export function MyTicketsClient({ initialSession }: { initialSession?: AttendeeSession | null }) {
  const [session, setSession] = useState<AttendeeSession | null>(initialSession ?? null);
  const [loading, setLoading] = useState<boolean>(!initialSession);
  const [orders, setOrders] = useState<OrderTicketsDto[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  // Lookup form state
  const [emailInput, setEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (initialSession) {
      setSession(initialSession);
      fetchAttendeeOrders()
        .then((data) => {
          if (active) setOrders(data);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }

    fetchAttendeeSession()
      .then((sess) => {
        if (!active) return;
        setSession(sess);
        if (sess) {
          return fetchAttendeeOrders().then((data) => {
            if (active) setOrders(data);
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialSession]);

  const handleRequestLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSentNotice(null);

    const email = emailInput.trim();
    const result = await requestAttendeeLink(email);

    setSubmitting(false);
    if (result.ok) {
      // Row 4.2: constant confirmation message regardless of email existence (no account enumeration)
      setSentNotice(`Check your email. If ${email} has tickets, the link is on its way.`);
      setEmailInput('');
    } else if (result.kind === 'rate-limited') {
      setErrorMessage('Too many requests. Please wait a few minutes before trying again.');
    } else if (result.kind === 'invalid') {
      setErrorMessage(result.message || 'Please enter a valid email address.');
    } else {
      setErrorMessage("We couldn't send the link right now. Please try again.");
    }
  };

  const handleSignOut = async () => {
    await signOutAttendee();
    setSession(null);
    setOrders([]);
    setSentNotice(null);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.loadingBox}>Loading tickets…</div>
        </div>
      </div>
    );
  }

  // 1. Signed-out view: "Find your tickets" (Row 4.2)
  if (!session) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <header className={styles.header}>
            <h1 className={styles.title}>Find your tickets</h1>
            <p className={styles.subtitle}>
              Enter your email to receive a secure link to your tickets.
            </p>
          </header>

          <div className={styles.formCard}>
            {sentNotice ? (
              <div role="status" className={`${styles.alert} ${styles.alertSuccess}`}>
                {sentNotice}
              </div>
            ) : (
              <form onSubmit={handleRequestLink} className={styles.form}>
                {errorMessage && (
                  <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
                    {errorMessage}
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@example.com"
                    className={styles.input}
                    disabled={submitting}
                  />
                </div>
                <button type="submit" disabled={submitting} className={styles.submitButton}>
                  {submitting ? 'Sending link…' : 'Email me a link'}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    );
  }

  // 2. Signed-in view: "My tickets" with Upcoming / Past tabs (Row 4.1)
  const { upcoming, past } = splitOrders(orders);
  const displayedOrders = activeTab === 'upcoming' ? upcoming : past;

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>My tickets</h1>
            <div className={styles.userBadge}>
              <span>{session.email}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className={styles.signOutButton}
                aria-label="Sign out"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <nav aria-label="Ticket categories" className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'upcoming' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('upcoming')}
            aria-selected={activeTab === 'upcoming'}
            role="tab"
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'past' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('past')}
            aria-selected={activeTab === 'past'}
            role="tab"
          >
            Past ({past.length})
          </button>
        </nav>

        <section aria-live="polite" className={styles.orderList}>
          {displayedOrders.length === 0 ? (
            <div className={styles.emptyState}>
              {activeTab === 'upcoming' ? (
                <>
                  <p className={styles.emptyTitle}>No upcoming tickets.</p>
                  <Link href="/" className={styles.browseLink}>
                    Find something on this weekend
                  </Link>
                </>
              ) : (
                <p className={styles.emptyTitle}>No past tickets.</p>
              )}
            </div>
          ) : (
            displayedOrders.map((order) => {
              const ticketCount = order.tickets.length;
              const countLabel = `${ticketCount} ${ticketCount === 1 ? 'ticket' : 'tickets'}`;
              return (
                <article key={order.orderId} className={styles.card}>
                  <span className={styles.cardEyebrow}>
                    {eventEyebrow(order.event.startsAt, order.event.timeZone)}
                  </span>
                  <h2 className={styles.cardTitle}>{order.event.name}</h2>
                  <p className={styles.cardVenue}>{venueLine(order.event.venue)}</p>
                  <footer className={styles.cardFooter}>
                    <span className={styles.ticketCount}>{countLabel}</span>
                    <Link
                      href={`/tickets/${order.orderId}`}
                      className={styles.ctaButton}
                      aria-label={`Show QR for ${order.event.name}`}
                    >
                      Show QR
                    </Link>
                  </footer>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
