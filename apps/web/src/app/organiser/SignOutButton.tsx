'use client';

import { useState } from 'react';
import { signOut } from '@/lib/auth-client';
import styles from './organiser.module.css';

/** "Sign out" in the organiser header (SEC-16): ends the session, clears drafts, then /signin. */
export function SignOutButton() {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const busy = state === 'busy';

  async function onClick() {
    if (busy) return;
    setState('busy');
    if (await signOut()) {
      // A full load, so nothing from the signed-in page stays in memory.
      window.location.assign('/signin');
    } else {
      // The session may still be live: say so rather than look signed out (Security, #72).
      setState('failed');
    }
  }

  return (
    <div className={styles.signOut}>
      <button
        type="button"
        className={styles.headerLink}
        onClick={onClick}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {state === 'failed' && (
        <p role="alert" className={styles.signOutError}>
          We couldn&apos;t sign you out. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
