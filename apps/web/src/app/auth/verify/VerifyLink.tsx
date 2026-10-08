'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from '@/components/screen.module.css';
import { verifyMagicLink } from '@/lib/auth-client';

type State = 'verifying' | 'expired' | 'failed';

/** Reads the one-time token from the URL fragment, e.g. /auth/verify#token=abc. */
export function readToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token && token.length > 0 ? token : null;
}

// The token sits in the fragment so it never reaches server logs or Referer headers, and the
// exchange is a POST from script so email link scanners that prefetch URLs can't burn it.
export function VerifyLink() {
  const router = useRouter();
  const [state, setState] = useState<State>('verifying');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // Strict Mode runs effects twice; a token is single use.
    started.current = true;

    const token = readToken(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setState('expired');
      return;
    }
    void verifyMagicLink(token).then((result) => {
      if (result.ok) router.replace('/organiser');
      else setState(result.kind);
    });
  }, [router]);

  return (
    <main className={styles.main} aria-live="polite">
      {state === 'verifying' && (
        <h1 className={`${styles.display} ${styles.pageTitle}`}>Signing you in…</h1>
      )}
      {state === 'expired' && (
        <>
          <h1 className={`${styles.display} ${styles.pageTitle}`}>This link has expired</h1>
          <p className={styles.text}>
            Sign-in links work once, for 15 minutes. Send yourself a new one and you&apos;ll be in.
          </p>
          <a href="/signin" className={styles.primaryButton}>
            Send a new link
          </a>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 className={`${styles.display} ${styles.pageTitle}`}>We couldn&apos;t sign you in</h1>
          <p className={styles.text}>
            Check your connection, then open the link from your email again.
          </p>
          <a href="/signin" className={styles.textButton}>
            Back to sign in
          </a>
        </>
      )}
    </main>
  );
}
