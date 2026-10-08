'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GoogleMark, Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { googleStartUrl, requestMagicLink } from '@/lib/auth-client';
import type { FieldError, MagicLinkRequest } from '@/lib/contract';
import { ORGANISER_NAME_MAX, validateSignup } from '@/lib/validation';
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
  /** Sign-up asks for an organiser name; sign-in, for returning organisers, asks only for email. */
  mode?: 'signup' | 'signin';
  initialError: 'google' | 'link' | null;
};

export function SignupForm({ mode = 'signup', initialError }: Props) {
  const isSignup = mode === 'signup';
  const [step, setStep] = useState<Step>('form');
  const [values, setValues] = useState<MagicLinkRequest>({ email: '', organiserName: '' });
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [banner, setBanner] = useState<Banner>(initialError);
  const [sending, setSending] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const returningToForm = useRef(false);

  // Coming back from the Sent state, put focus where the person will type.
  useEffect(() => {
    if (step === 'form' && returningToForm.current) emailRef.current?.focus();
  }, [step]);

  const errorFor = (field: FieldError['field']) => errors.find((e) => e.field === field)?.message;

  function focusFirst(found: FieldError[]) {
    const first = found[0];
    if (!first) return;
    (first.field === 'email' ? emailRef : nameRef).current?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const input = request();
    const found = validateSignup(input, { requireName: isSignup });
    setErrors(found);
    if (found.length) {
      setBanner(null);
      focusFirst(found);
      return;
    }

    setSending(true);
    const result = await requestMagicLink(input);
    setSending(false);

    if (result.ok) {
      setBanner(null);
      setStep('sent');
    } else if (result.kind === 'field') {
      setBanner(null);
      setErrors([result.error]);
      focusFirst([result.error]);
    } else {
      setBanner(result.kind);
    }
  }

  function request(): MagicLinkRequest {
    const email = values.email.trim();
    return isSignup ? { email, organiserName: (values.organiserName ?? '').trim() } : { email };
  }

  function backToForm() {
    returningToForm.current = true;
    setStep('form');
  }

  if (step === 'sent') {
    return <SentPanel request={request()} onUseDifferentEmail={backToForm} />;
  }

  const emailError = errorFor('email');
  const nameError = errorFor('organiserName');

  return (
    <main className={screen.main}>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={sending || undefined}>
        {banner && (
          <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
            <Icon name="alert" />
            <p>{bannerText[banner]}</p>
          </div>
        )}

        <a
          href={googleStartUrl(isSignup ? (values.organiserName ?? '') : '')}
          className={styles.googleButton}
        >
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
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
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
          <>
            <div className={styles.field}>
              <label htmlFor="su-org">Organiser name</label>
              <input
                ref={nameRef}
                id="su-org"
                name="organiserName"
                autoComplete="organization"
                maxLength={ORGANISER_NAME_MAX}
                value={values.organiserName ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, organiserName: e.target.value }))}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'su-org-error su-org-hint' : 'su-org-hint'}
              />
              {nameError && (
                <span id="su-org-error" className={styles.fieldError}>
                  <Icon name="alert" size={16} />
                  {nameError}
                </span>
              )}
              <span id="su-org-hint" className={styles.hint}>
                Shown on your event pages. Your own name is fine.
              </span>
            </div>

            <div className={`${screen.notice} ${screen.noticeInfo}`}>
              <Icon name="info" />
              <p>
                No ABN or bank details needed now. We&apos;ll ask for them only when you first sell
                paid tickets.
              </p>
            </div>
          </>
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
