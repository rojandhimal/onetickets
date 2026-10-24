'use client';

import { useState } from 'react';
import { signOut } from '@/lib/auth-client';
import styles from './organiser.module.css';

/** "Sign out" in the organiser header (SEC-16): ends the session, clears drafts, then /signin. */
export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    await signOut();
    // A full load, so nothing from the signed-in page stays in memory.
    window.location.assign('/signin');
  }

  return (
    <button
      type="button"
      className={styles.headerLink}
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
