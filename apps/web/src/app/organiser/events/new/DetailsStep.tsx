'use client';

import {
  ACCESSIBILITY_FEATURES,
  type AccessibilityFeature,
  CANCELLATION_POLICIES,
  type CancellationPolicy,
  EVENT_LIMITS,
  type EventDraftDto,
} from '@onetickets/shared';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { PendingChanges } from '@/lib/draft-store';
import { ACCESSIBILITY_LABELS } from '@/lib/event-page';
import { ABOUT_PROMPTS } from '@/lib/templates';
import type { ServerErrors } from './BasicsStep';
import styles from './wizard.module.css';

/** Artboard 8b, free events: what each choice means for someone holding a ticket. */
export const CANCELLATION_CHOICES: Record<CancellationPolicy, { label: string; hint: string }> = {
  any_time: {
    label: 'Any time before it starts',
    hint: 'Recommended for free events. Released tickets go back on sale.',
  },
  up_to_24h: { label: 'Up to 24 hours before', hint: 'After that, tickets stay booked.' },
  none: { label: 'No cancellations', hint: "Tickets can't be released once booked." },
};

export const CONTACT_EMAIL_ERROR = 'Enter an email address, like name@example.com';

// The api's own check is zod's email(); this only catches typing slips before a round trip.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const count = new Intl.NumberFormat('en-AU');

/** Artboard 8b: About, Accessibility, Cancellations and the attendee contact email. */
export function DetailsStep({
  event,
  headingRef,
  serverErrors = {},
  onChange,
  onBlur,
}: {
  event: EventDraftDto;
  headingRef: RefObject<HTMLHeadingElement | null>;
  serverErrors?: ServerErrors;
  onChange: (changes: PendingChanges) => void;
  onBlur: () => void;
}) {
  const [about, setAbout] = useState(event.about);
  const [features, setFeatures] = useState<AccessibilityFeature[]>(event.accessibility.features);
  const [notes, setNotes] = useState(event.accessibility.notes);
  const [policy, setPolicy] = useState(event.cancellationPolicy);
  const [email, setEmail] = useState(event.contactEmail ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);

  function changeFeature(feature: AccessibilityFeature, on: boolean) {
    // Keep the order of the list, whatever order they were ticked in.
    const next = ACCESSIBILITY_FEATURES.filter((f) => (f === feature ? on : features.includes(f)));
    setFeatures(next);
    onChange({ accessibility: { features: next, notes } });
    onBlur();
  }

  function changeNotes(text: string) {
    setNotes(text);
    onChange({ accessibility: { features, notes: text } });
  }

  function changePolicy(next: CancellationPolicy) {
    setPolicy(next);
    onChange({ cancellationPolicy: next });
    onBlur();
  }

  function changeEmail(text: string) {
    setEmail(text);
    const trimmed = text.trim();
    if (emailError && (!trimmed || EMAIL.test(trimmed))) setEmailError(null);
    onChange({ contactEmail: EMAIL.test(trimmed) ? trimmed.toLowerCase() : null });
  }

  function checkEmail() {
    const trimmed = email.trim();
    setEmailError(trimmed && !EMAIL.test(trimmed) ? CONTACT_EMAIL_ERROR : null);
    onBlur();
  }

  const aboutError = serverErrors.about ?? null;
  const accessError = serverErrors.accessibility ?? null;
  const shownEmailError = emailError ?? serverErrors.contactEmail ?? null;

  return (
    <main className={styles.body}>
      <div className={styles.heading}>
        <h1 ref={headingRef} tabIndex={-1}>
          Tell people more
        </h1>
        <span className={styles.lede}>All optional, but events with these get more bookings.</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="ev-about">About this event</label>
        <textarea
          id="ev-about"
          rows={5}
          maxLength={EVENT_LIMITS.about}
          placeholder={ABOUT_PROMPTS[event.template]}
          value={about}
          aria-invalid={aboutError ? true : undefined}
          aria-describedby={
            aboutError
              ? 'ev-about-error ev-about-hint ev-about-count'
              : 'ev-about-hint ev-about-count'
          }
          onChange={(e) => {
            setAbout(e.target.value);
            onChange({ about: e.target.value });
          }}
          onBlur={onBlur}
        />
        <FieldError id="ev-about-error" message={aboutError} />
        <div className={styles.hintRow}>
          <span id="ev-about-hint">Say what people will do and what to bring.</span>
          <CharacterCount id="ev-about-count" length={about.length} max={EVENT_LIMITS.about} />
        </div>
      </div>

      <fieldset className={styles.fieldset} aria-describedby="acc-hint">
        <legend className={styles.groupLegend}>Accessibility</legend>
        <span id="acc-hint" className={styles.groupHint}>
          Shown near the top of your event page. Tick what&apos;s true for your venue.
        </span>
        <div className={styles.choiceList}>
          {ACCESSIBILITY_FEATURES.map((feature) => (
            <label key={feature} className={styles.choice}>
              <input
                type="checkbox"
                checked={features.includes(feature)}
                onChange={(e) => changeFeature(feature, e.target.checked)}
              />
              <span>{ACCESSIBILITY_LABELS[feature]}</span>
            </label>
          ))}
        </div>
        <div className={styles.field}>
          <label htmlFor="acc-notes">Anything else people should know?</label>
          <textarea
            id="acc-notes"
            rows={3}
            maxLength={EVENT_LIMITS.accessibilityNotes}
            value={notes}
            aria-invalid={accessError ? true : undefined}
            aria-describedby={
              accessError
                ? 'acc-notes-error acc-notes-hint acc-notes-count'
                : 'acc-notes-hint acc-notes-count'
            }
            onChange={(e) => changeNotes(e.target.value)}
            onBlur={onBlur}
          />
          <FieldError id="acc-notes-error" message={accessError} />
          <div className={styles.hintRow}>
            <span id="acc-notes-hint">
              For example parking, lighting, noise or a contact for access requests.
            </span>
            <CharacterCount
              id="acc-notes-count"
              length={notes.length}
              max={EVENT_LIMITS.accessibilityNotes}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.groupLegend}>Cancellations</legend>
        <div className={styles.choiceList}>
          {CANCELLATION_POLICIES.map((p) => (
            <label key={p} className={`${styles.choice} ${styles.choiceTall}`}>
              <input
                type="radio"
                name="cancellations"
                value={p}
                checked={policy === p}
                aria-labelledby={`cancel-${p}`}
                aria-describedby={`cancel-${p}-hint`}
                onChange={() => changePolicy(p)}
              />
              <span className={styles.choiceText}>
                <span id={`cancel-${p}`}>{CANCELLATION_CHOICES[p].label}</span>
                <span id={`cancel-${p}-hint`} className={styles.hint}>
                  {CANCELLATION_CHOICES[p].hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="ev-contact">Contact email for attendees</label>
        <input
          id="ev-contact"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          aria-invalid={shownEmailError ? true : undefined}
          aria-describedby={
            shownEmailError ? 'ev-contact-error ev-contact-hint' : 'ev-contact-hint'
          }
          onChange={(e) => changeEmail(e.target.value)}
          onBlur={checkEmail}
        />
        <FieldError id="ev-contact-error" message={shownEmailError} />
        <span id="ev-contact-hint" className={styles.hint}>
          Only shown to people with a ticket.
        </span>
      </div>
    </main>
  );
}

/**
 * "168 / 2,000" on screen. Screen readers hear "1,832 characters left" once typing pauses,
 * rather than a number on every key.
 */
function CharacterCount({ id, length, max }: { id: string; length: number; max: number }) {
  const [spoken, setSpoken] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const left = max - length;
    const timer = setTimeout(
      () => setSpoken(`${count.format(left)} ${left === 1 ? 'character' : 'characters'} left`),
      800,
    );
    return () => clearTimeout(timer);
  }, [length, max]);

  return (
    <>
      <span id={id} className={styles.count}>
        {count.format(length)} / {count.format(max)}
      </span>
      <span aria-live="polite" className="visually-hidden">
        {spoken}
      </span>
    </>
  );
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <span id={id} className={styles.fieldError}>
      <Icon name="alert" size={16} />
      {message}
    </span>
  );
}
