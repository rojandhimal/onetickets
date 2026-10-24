'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { Turnstile, type TurnstileHandle } from '@/components/Turnstile';
import { requestMagicLink } from '@/lib/auth-client';
import styles from './signup.module.css';

export const RESEND_AFTER_SECONDS = 30;

type ResendStatus = 'idle' | 'sending' | 'sent' | ResendError;
type ResendError = 'rate-limited' | 'challenge' | 'unavailable' | 'failed';

const resendError: Record<ResendError, string> = {
  'rate-limited': "You've asked for a few links in a row. Wait a minute, then try again.",
  challenge: "We couldn't finish the security check. Try again.",
  unavailable: "We can't send sign-in links for a moment. Try again in a minute.",
  failed: "We couldn't send it again. Check your connection and try again.",
};

type Props = {
  email: string;
  onUseDifferentEmail: () => void;
  /** Cloudflare Turnstile site key when SEC-10 is on, else null. */
  turnstileSiteKey?: string | null;
};

export function SentPanel({ email, onUseDifferentEmail, turnstileSiteKey = null }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);
  const [status, setStatus] = useState<ResendStatus>('idle');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const turnstile = useRef<TurnstileHandle>(null);

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
    const token = turnstileSiteKey ? await turnstile.current?.getToken() : undefined;
    if (turnstileSiteKey && !token) {
      // Nothing was sent, so they can try again straight away.
      setStatus('challenge');
      return;
    }
    const result = await requestMagicLink(email, token ?? undefined);
    if (result.ok) setStatus('sent');
    else setStatus(result.kind === 'invalid' ? 'failed' : result.kind);
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
      {turnstileSiteKey && (
        <Turnstile
          ref={turnstile}
          siteKey={turnstileSiteKey}
          action="resend"
          className={styles.turnstile}
        />
      )}
      {status in resendError && (
        <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
          <Icon name="alert" />
          <p>{resendError[status as ResendError]}</p>
        </div>
      )}
    </main>
  );
}
