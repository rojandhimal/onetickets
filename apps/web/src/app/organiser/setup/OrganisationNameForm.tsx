'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { createOrganisation } from '@/lib/auth-client';
import { ORGANISER_NAME_MAX, validateOrganiserName } from '@/lib/validation';
import styles from '../../signup/signup.module.css';

const bannerText = {
  'rate-limited': 'Too many tries in a row. Wait a minute, then try again.',
  failed: "We couldn't save that. Check your connection and try again.",
} as const;

export function OrganisationNameForm({ suggestion }: { suggestion: string }) {
  const router = useRouter();
  const [name, setName] = useState(suggestion);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<keyof typeof bannerText | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function showError(message: string) {
    setBanner(null);
    setError(message);
    inputRef.current?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const invalid = validateOrganiserName(name);
    if (invalid) {
      showError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createOrganisation(name.trim());
    if (result.ok) {
      router.replace('/organiser');
      router.refresh();
      return;
    }
    setSaving(false);
    if (result.kind === 'invalid') showError(result.message);
    else setBanner(result.kind);
  }

  return (
    <main className={screen.main}>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={saving || undefined}>
        {banner && (
          <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
            <Icon name="alert" />
            <p>{bannerText[banner]}</p>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="org-name">Organiser name</label>
          <input
            ref={inputRef}
            id="org-name"
            name="name"
            autoComplete="organization"
            maxLength={ORGANISER_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'org-name-error org-name-hint' : 'org-name-hint'}
          />
          {error && (
            <span id="org-name-error" className={styles.fieldError}>
              <Icon name="alert" size={16} />
              {error}
            </span>
          )}
          <span id="org-name-hint" className={styles.hint}>
            Shown on your event pages. Your own name is fine.
          </span>
        </div>

        <div className={`${screen.notice} ${screen.noticeInfo}`}>
          <Icon name="info" />
          <p>
            No ABN or bank details needed now. We&apos;ll ask for them only when you first sell paid
            tickets.
          </p>
        </div>

        <div className={styles.spacer} />

        <button type="submit" className={screen.primaryButton} disabled={saving}>
          {saving ? (
            <>
              <span className={screen.spinner} aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Continue'
          )}
        </button>
      </form>
    </main>
  );
}
