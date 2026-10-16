'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

/** Opens the phone's share sheet, or copies the link where there isn't one. */
export function ShareButton({
  title,
  className,
  statusClassName,
}: {
  title: string;
  className?: string;
  statusClassName?: string;
}) {
  const [status, setStatus] = useState('');

  async function share() {
    const url = window.location.href.split('#')[0] ?? window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closing the share sheet rejects; nothing to say.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied');
    } catch {
      setStatus("Couldn't copy the link. Copy it from the address bar.");
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label="Share event"
        onClick={() => void share()}
      >
        <Icon name="share" />
      </button>
      <span role="status" className={status ? statusClassName : 'visually-hidden'}>
        {status}
      </span>
    </>
  );
}
