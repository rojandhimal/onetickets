import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicOrder } from '@/lib/checkout';
import styles from './confirmation.module.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ orderRef: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderRef } = await params;
  return {
    title: `You're going! · OneTickets`,
    description: `Ticket confirmation for order ${orderRef}.`,
  };
}

export default async function ConfirmationPage({ params }: Props) {
  const { orderRef } = await params;
  const order = await getPublicOrder(orderRef);
  if (!order) notFound();

  const ticketWord = order.ticketCount === 1 ? 'ticket' : 'tickets';
  const firstTicket = order.tickets[0];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>You&apos;re going!</h1>
          <p className={styles.subtitle}>
            We&apos;ve also emailed your {ticketWord} to {order.attendeeEmail}
          </p>
        </header>

        <section className={styles.ticketCard} aria-label="Ticket details">
          {order.eventTitle && <h2 className={styles.eventTitle}>{order.eventTitle}</h2>}

          <div className={styles.ticketDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Attendee</span>
              <span className={styles.detailValue}>{order.attendeeName}</span>
            </div>
            {firstTicket && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Type</span>
                <span className={styles.detailValue}>{firstTicket.ticketTypeName}</span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Tickets</span>
              <span className={styles.detailValue}>{order.ticketCount}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Reference</span>
              <span className={styles.detailValue}>{order.orderRef}</span>
            </div>
          </div>

          <div className={styles.qrPlaceholder}>
            <svg
              className={styles.qrCode}
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label={`QR code for ticket reference ${order.orderRef}`}
              role="img"
            >
              <rect width="100" height="100" fill="white" />
              <rect x="10" y="10" width="30" height="30" fill="currentColor" />
              <rect x="15" y="15" width="20" height="20" fill="white" />
              <rect x="20" y="20" width="10" height="10" fill="currentColor" />
              <rect x="60" y="10" width="30" height="30" fill="currentColor" />
              <rect x="65" y="15" width="20" height="20" fill="white" />
              <rect x="70" y="20" width="10" height="10" fill="currentColor" />
              <rect x="10" y="60" width="30" height="30" fill="currentColor" />
              <rect x="15" y="65" width="20" height="20" fill="white" />
              <rect x="20" y="70" width="10" height="10" fill="currentColor" />
              <rect x="50" y="50" width="15" height="15" fill="currentColor" />
              <rect x="70" y="60" width="20" height="10" fill="currentColor" />
              <rect x="60" y="75" width="15" height="15" fill="currentColor" />
              <rect x="80" y="80" width="10" height="10" fill="currentColor" />
            </svg>
          </div>

          <p className={styles.qrNote}>
            Screen brightness goes up while this is open so the door can scan it.
          </p>
        </section>

        <div className={styles.actions}>
          <Link href="/" className={styles.secondaryAction}>
            Find more events
          </Link>
        </div>
      </div>
    </main>
  );
}
