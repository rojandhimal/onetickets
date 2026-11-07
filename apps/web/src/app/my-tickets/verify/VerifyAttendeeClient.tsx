'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { verifyAttendeeLink } from '@/lib/attendee';
import styles from '../my-tickets.module.css';

type VerifyState =
  | { status: 'verifying' }
  | { status: 'success' }
  | { status: 'expired' }
  | { status: 'failed'; message: string };

export function VerifyAttendeeClient() {
  const router = useRouter();
  const [state, setState] = useState<VerifyState>({ status: 'verifying' });
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Row 4.3: Extract token from hash fragment and immediately strip it
    const hash = window.location.hash;
    const match = hash.match(/token=([A-Za-z0-9_-]+)/);

    // Strip fragment immediately from history/location so it never leaks
    window.history.replaceState(null, '', window.location.pathname);

    const token = match?.[1];
    if (!token) {
      setState({
        status: 'failed',
        message: 'No valid ticket link was found in the URL.',
      });
      return;
    }

    verifyAttendeeLink(token).then((result) => {
      if (result.ok) {
        setState({ status: 'success' });
        router.replace('/my-tickets');
      } else if (result.kind === 'expired') {
        setState({ status: 'expired' });
      } else {
        setState({
          status: 'failed',
          message: "We couldn't verify your ticket link. Please try again.",
        });
      }
    });
  }, [router]);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.formCard}>
          {state.status === 'verifying' && (
            <div className={styles.loadingBox}>
              <p>Verifying your tickets link…</p>
            </div>
          )}

          {state.status === 'success' && (
            <div className={styles.loadingBox}>
              <p>Signed in! Opening your tickets…</p>
            </div>
          )}

          {state.status === 'expired' && (
            <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
              <h2 className={styles.emptyTitle}>That link doesn't work any more.</h2>
              <p className={styles.subtitle}>
                Attendee ticket links work once, for 15 minutes. You can request a new link at any
                time.
              </p>
              <div style={{ marginTop: '16px' }}>
                <Link href="/my-tickets" className={styles.ctaButton}>
                  Request a new link
                </Link>
              </div>
            </div>
          )}

          {state.status === 'failed' && (
            <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
              <h2 className={styles.emptyTitle}>Verification failed</h2>
              <p className={styles.subtitle}>{state.message}</p>
              <div style={{ marginTop: '16px' }}>
                <Link href="/my-tickets" className={styles.ctaButton}>
                  Return to My tickets
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
