'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { requestMagicLink } from '@/lib/auth-client';
import styles from './signup.module.css';

export const RESEND_AFTER_SECONDS = 30;

type ResendStatus = 'idle' | 'sending' | 'sent' | 'rate-limited' | 'failed';

const resendError: Record<'rate-limited' | 'failed', string> = {
  'rate-limited': "You've asked for a few links in a row. Wait a minute, then try again.",
  failed: "We couldn't send it again. Check your connection and try again.",
};

type Props = {
  email: string;
  onUseDifferentEmail: () => void;
};

export function SentPanel({ email, onUseDifferentEmail }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);
  const [status, setStatus] = useState<ResendStatus>('idle');
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new state so screen reader and keyboard users follow along.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function resend() {
    setStatus('sending');
    const result = await requestMagicLink(email);
    if (result.ok) setStatus('sent');
    else setStatus(result.kind === 'rate-limited' ? 'rate-limited' : 'failed');
    setSecondsLeft(RESEND_AFTER_SECONDS);
  }

  const canResend = secondsLeft <= 0 && status !== 'sending';

  return (
    <main className={`${screen.main} ${styles.sent}`}>
      <div className={styles.sentIcon}>
        <Icon name="mail" size={30} />
      </div>
      <div role="status">
        <h2 ref={headingRef} tabIndex={-1} className={`${screen.display} ${screen.pageTitle}`}>
          Check your email
        </h2>
      </div>
      <p>
        We&apos;ve sent a link to <strong>{email}</strong>. Open it on any device within 15 minutes.
        Not there? Check your spam folder.
      </p>
      <div className={styles.sentActions}>
        <button type="button" className={screen.textButton} onClick={onUseDifferentEmail}>
          Use a different email
        </button>
        <button type="button" className={screen.textButton} onClick={resend} disabled={!canResend}>
          {status === 'sending'
            ? 'Sending it again…'
            : secondsLeft > 0
              ? `You can resend in ${secondsLeft}s`
              : "Didn't get it? Send it again"}
        </button>
      </div>
      <p role="status" className={styles.resendStatus}>
        {status === 'sent' ? "Sent again. Check your spam folder if it's not there." : ''}
      </p>
      {(status === 'rate-limited' || status === 'failed') && (
        <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
          <Icon name="alert" />
          <p>{resendError[status]}</p>
        </div>
      )}
    </main>
  );
}
