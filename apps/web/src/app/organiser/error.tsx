'use client';

import { useEffect } from 'react';
import { Logo } from '@/components/Logo';
import screen from '@/components/screen.module.css';

// Shown when the organiser home can't load, for example when the api is down.
export default function OrganiserError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={screen.screen}>
      <header className={screen.header}>
        <div className={screen.headerInner}>
          <Logo />
        </div>
      </header>
      <main className={screen.main} role="alert">
        <h1 className={`${screen.display} ${screen.pageTitle}`}>
          We couldn&apos;t load your events
        </h1>
        <p className={screen.text}>
          This is on our side, not yours. Try again in a moment. Nothing you&apos;ve made has been
          lost.
        </p>
        <button type="button" className={screen.primaryButton} onClick={reset}>
          Try again
        </button>
      </main>
    </div>
  );
}
