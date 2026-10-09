'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GoogleMark, Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { GOOGLE_START_URL, requestMagicLink } from '@/lib/auth-client';
import { validateEmail } from '@/lib/validation';
import { SentPanel } from './SentPanel';
import styles from './signup.module.css';

type Step = 'form' | 'sent';
type Banner = 'google' | 'link' | 'rate-limited' | 'failed' | null;

const bannerText: Record<Exclude<Banner, null>, string> = {
  google: "Google sign-in didn't finish. Try again, or use your email instead.",
  link: 'That sign-in link has expired or was already used. Send yourself a new one.',
  'rate-limited': "You've asked for a few links in a row. Wait a minute, then try again.",
  failed: "We couldn't send the link. Check your connection and try again.",
};

type Props = {
  /** Same form either way: everyone starts with just an email (PM decision, 8 Oct). */
  mode?: 'signup' | 'signin';
  initialError: 'google' | 'link' | null;
};

export function SignupForm({ mode = 'signup', initialError }: Props) {
  const isSignup = mode === 'signup';
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(initialError);
  const [sending, setSending] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const returningToForm = useRef(false);

  // Coming back from the Sent state, put focus where the person will type.
  useEffect(() => {
    if (step === 'form' && returningToForm.current) emailRef.current?.focus();
  }, [step]);

  function showEmailError(message: string) {
    setBanner(null);
    setEmailError(message);
    emailRef.current?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const invalid = validateEmail(email);
    if (invalid) {
      showEmailError(invalid);
      return;
    }
    setEmailError(null);

    setSending(true);
    const result = await requestMagicLink(email.trim());
    setSending(false);

    if (result.ok) {
      setBanner(null);
      setStep('sent');
    } else if (result.kind === 'invalid') {
      showEmailError(result.message);
    } else {
      setBanner(result.kind);
    }
  }

  function backToForm() {
    returningToForm.current = true;
    setStep('form');
  }

  if (step === 'sent') {
    return <SentPanel email={email.trim()} onUseDifferentEmail={backToForm} />;
  }

  return (
    <main className={screen.main}>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={sending || undefined}>
        {banner && (
          <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
            <Icon name="alert" />
            <p>{bannerText[banner]}</p>
          </div>
        )}

        <a href={GOOGLE_START_URL} className={styles.googleButton}>
          <GoogleMark />
          Continue with Google
        </a>

        <div className={styles.divider}>or use your email</div>

        <div className={styles.field}>
          <label htmlFor="su-email">Email</label>
          <input
            ref={emailRef}
            id="su-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'su-email-error' : undefined}
          />
          {emailError && (
            <span id="su-email-error" className={styles.fieldError}>
              <Icon name="alert" size={16} />
              {emailError}
            </span>
          )}
        </div>

        {isSignup && (
          <div className={`${screen.notice} ${screen.noticeInfo}`}>
            <Icon name="info" />
            <p>
              No ABN or bank details needed now. We&apos;ll ask for them only when you first sell
              paid tickets.
            </p>
          </div>
        )}

        <div className={styles.spacer} />

        <button type="submit" className={screen.primaryButton} disabled={sending}>
          {sending ? (
            <>
              <span className={screen.spinner} aria-hidden="true" />
              Sending link…
            </>
          ) : (
            'Email me a sign-in link'
          )}
        </button>
        <p className={styles.switchMode}>
          {isSignup ? (
            <>
              Already signed up? <a href="/signin">Sign in</a>
            </>
          ) : (
            <>
              New to OneTickets? <a href="/signup">Sign up</a>
            </>
          )}
        </p>
        <p className={styles.legal}>
          By continuing you agree to the <a href="/legal/organiser-terms">organiser terms</a> and{' '}
          <a href="/legal/privacy">privacy policy</a>.
        </p>
      </form>
    </main>
  );
}
