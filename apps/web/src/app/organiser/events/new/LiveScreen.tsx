'use client';

import type { EventDraftDto } from '@onetickets/shared';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import styles from './wizard.module.css';

export function eventPagePath(slug: string): string {
  return `/e/${encodeURIComponent(slug)}`;
}

/** "Your event is live" (8c, after publishing). The heading takes focus when it appears. */
export function LiveScreen({ event }: { event: EventDraftDto }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    headingRef.current?.focus();
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === 'function');
  }, []);

  const path = event.slug ? eventPagePath(event.slug) : '/organiser';
  const url = `${origin}${path}`;
  const shownUrl = url.replace(/^https?:\/\//, '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setStatus('Link copied');
    } catch {
      setStatus("Couldn't copy. Press and hold the link to copy it.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: event.name ?? undefined, url });
    } catch {
      // Closing the share sheet rejects; nothing to tell the organiser.
    }
  }

  return (
    <main className={styles.live} aria-labelledby="live-h">
      <div className={styles.liveInner}>
        <div className={styles.liveBadge}>
          <Icon name="check" size={32} />
        </div>
        <h1 id="live-h" ref={headingRef} tabIndex={-1}>
          Your event is live
        </h1>
        <p>Share the link and we&apos;ll tell you the moment someone books.</p>
        <div className={styles.linkBox}>
          <span id="live-link" className={styles.linkText}>
            {shownUrl}
          </span>
          <button
            type="button"
            className={styles.copyButton}
            onClick={() => void copy()}
            aria-describedby="live-link"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {canShare && (
          <button type="button" className={styles.shareButton} onClick={() => void share()}>
            <Icon name="share" />
            Share to Instagram, WhatsApp…
          </button>
        )}
        <span role="status" className={styles.liveStatus}>
          {status}
        </span>
        <div className={styles.liveSpacer} />
        <a href={path} className={styles.livePrimary}>
          See your event page
        </a>
        <a href="/organiser" className={styles.liveSecondary}>
          Back to your events
        </a>
      </div>
    </main>
  );
}
