'use client';

import { type EventDraftDto, WIZARD_STEPS } from '@onetickets/shared';
import { usePathname, useRouter } from 'next/navigation';
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import type { PendingChanges } from '@/lib/draft-store';
import { type SaveState, useAutosave } from '@/lib/use-autosave';
import {
  STEP_LABELS,
  type WizardStep,
  isStepComplete,
  isWizardStep,
  nextStep,
  previousStep,
  stepHref,
} from '@/lib/wizard-model';
import { BasicsStep, END_SAME_AS_START, type ServerErrors } from './BasicsStep';
import { DetailsStep } from './DetailsStep';
import { LiveScreen } from './LiveScreen';
import { ReviewStep } from './ReviewStep';
import { type TicketSaveState, TicketsStep } from './TicketsStep';
import styles from './wizard.module.css';

const SAVE_TEXT: Record<SaveState, string> = {
  saved: 'Draft saved',
  saving: 'Saving…',
  offline: 'Saved on this phone',
  failed: "Couldn't save. We'll keep trying.",
};

/** Our wording for the api's codes; its own message otherwise, never a bare code. */
export function refusedMessage(message: string, code?: string): string {
  if (code === 'ends_before_start' || message === 'ends_before_start') return END_SAME_AS_START;
  if (code === 'required_when_live') return 'A live event needs this. Add it back to keep it live.';
  return /^[a-z_]+$/.test(message) ? 'Check this and try again.' : message;
}

// Fields that show the api's message under them; anything else is the api's to explain.
const SHOWN_ERRORS = new Set<string>([
  'name',
  'startsAt',
  'endsAt',
  'venue',
  'about',
  'accessibility',
  'contactEmail',
]);

const REFUSED_TEXT = "Couldn't save one field. Check the message under it.";

function applyChanges(event: EventDraftDto, changes: PendingChanges): EventDraftDto {
  // The banner focal point lives on `banner`, which only the api sets.
  const rest: PendingChanges = { ...changes };
  delete rest.bannerFocus;
  return { ...event, ...(rest as Omit<PendingChanges, 'bannerFocus'>) };
}

/** Fields only the api changes; local typing never touches them. */
function serverFields(server: EventDraftDto) {
  const { version, updatedAt, ticketTypes, banner, slug, status } = server;
  return { version, updatedAt, ticketTypes, banner, slug, status };
}

export function Wizard({ initialEvent, userId }: { initialEvent: EventDraftDto; userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const segment = pathname.split('/').pop() ?? '';
  const step: WizardStep = isWizardStep(segment) ? segment : 'basics';

  const [event, setEvent] = useState(initialEvent);
  const [restored, setRestored] = useState(0);
  const [serverErrors, setServerErrors] = useState<ServerErrors>({});
  const [ticketSaveState, setTicketSaveState] = useState<TicketSaveState>('saved');
  const ticketFlushRef = useRef<(() => Promise<void>) | null>(null);
  const { saveState, change, flush, accept } = useAutosave({
    event: initialEvent,
    userId,
    onSaved: (server) => setEvent((prev) => ({ ...prev, ...serverFields(server) })),
    onRestore: (changes) => {
      setEvent((prev) => applyChanges(prev, changes));
      // Remount the step so its fields show what was kept on this device.
      setRestored((n) => n + 1);
    },
    // The value stays on screen with the api's message under it; the rest of the draft saves.
    onInvalid: (field, message, code) => {
      if (field && SHOWN_ERRORS.has(field))
        setServerErrors((prev) => ({ ...prev, [field]: refusedMessage(message, code) }));
    },
  });

  const update = useCallback(
    (changes: PendingChanges) => {
      setEvent((prev) => applyChanges(prev, changes));
      setServerErrors((prev) => {
        const touched = Object.keys(changes).filter((k) => k in prev);
        if (!touched.length) return prev;
        const next = { ...prev };
        for (const k of touched) delete next[k as keyof ServerErrors];
        return next;
      });
      change(changes);
    },
    [change],
  );

  // Reopening the draft resumes on the last step visited.
  const lastStep = useRef(initialEvent.lastStep);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    setTicketSaveState('saved');
    update({ lastStep: step });
    // Save now: someone who reaches a step and leaves by the browser should come back to it.
    void flush();
  }, [flush, step, update]);

  // Move focus to the new step's heading, but not on first load.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(step);
  useEffect(() => {
    if (firstStep.current === step) return;
    firstStep.current = '' as WizardStep;
    headingRef.current?.focus();
    window.scrollTo(0, 0);
  }, [step]);

  /** Step changes stay on this page so typing in flight is never lost. */
  const go = useCallback(
    (to: WizardStep) => (e?: MouseEvent) => {
      e?.preventDefault();
      void ticketFlushRef.current?.();
      void flush();
      window.history.pushState(null, '', stepHref(to, event.id));
    },
    [event.id, flush],
  );

  const leave = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      await ticketFlushRef.current?.();
      await flush();
      router.push('/organiser');
    },
    [flush, router],
  );

  const [published, setPublished] = useState<EventDraftDto | null>(null);
  if (published) return <LiveScreen event={published} />;

  // A field the api refused isn't saved, so the header mustn't say everything is.
  const refused = Object.keys(serverErrors).length > 0;
  const draftShownState: TicketSaveState = refused && saveState === 'saved' ? 'refused' : saveState;
  const shownState: TicketSaveState =
    step === 'tickets' && ticketSaveState !== 'saved' ? ticketSaveState : draftShownState;

  const back = previousStep(step);
  const next = nextStep(step);

  let body: ReactNode;
  switch (step) {
    case 'basics':
      body = (
        <BasicsStep
          key={restored}
          event={event}
          headingRef={headingRef}
          serverErrors={serverErrors}
          onChange={update}
          onBlur={() => void flush()}
          onBannerChanged={accept}
        />
      );
      break;
    case 'tickets':
      body = (
        <TicketsStep
          event={event}
          headingRef={headingRef}
          flushRef={ticketFlushRef}
          onTicketChanged={accept}
          onSaveStateChange={setTicketSaveState}
        />
      );
      break;
    case 'details':
      body = (
        <DetailsStep
          key={restored}
          event={event}
          headingRef={headingRef}
          serverErrors={serverErrors}
          onChange={update}
          onBlur={() => void flush()}
        />
      );
      break;
    case 'review':
      body = (
        <ReviewStep
          event={event}
          headingRef={headingRef}
          flush={flush}
          goTo={go}
          onPublished={setPublished}
        />
      );
      break;
  }

  return (
    <div className={styles.wizard}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.topRow}>
            {back ? (
              <a
                href={stepHref(back, event.id)}
                onClick={go(back)}
                className={styles.iconLink}
                aria-label={`Back to ${STEP_LABELS[back].toLowerCase()}`}
              >
                <Icon name="back" size={22} />
              </a>
            ) : (
              <a
                href="/organiser"
                onClick={leave}
                className={styles.iconLink}
                aria-label="Close and keep draft"
              >
                <Icon name="close" size={22} />
              </a>
            )}
            <span className={styles.title}>New event</span>
            <span role="status" className={`${styles.saveState} ${styles[shownState]}`}>
              {shownState === 'saved' && <Icon name="check" size={14} />}
              {shownState === 'offline' && <Icon name="wifi-off" size={14} />}
              {shownState === 'refused' ? REFUSED_TEXT : SAVE_TEXT[shownState]}
            </span>
          </div>
          <ol aria-label="Steps" className={styles.steps}>
            {WIZARD_STEPS.map((s, i) => {
              const current = s === step;
              const done = !current && isStepComplete(s, event);
              const label = `${i + 1} ${STEP_LABELS[s]}`;
              return (
                <li
                  key={s}
                  aria-current={current ? 'step' : undefined}
                  className={`${styles.step} ${current ? styles.stepCurrent : ''} ${done ? styles.stepDone : ''}`}
                >
                  {current ? (
                    <span className={styles.stepLink}>{label}</span>
                  ) : (
                    <a href={stepHref(s, event.id)} onClick={go(s)} className={styles.stepLink}>
                      {done && <Icon name="check" size={12} />}
                      {label}
                      {done && <span className="visually-hidden">, completed</span>}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {body}

      {next && (
        <div className={styles.footer}>
          <div className={styles.footerInner}>
            <a href={stepHref(next, event.id)} onClick={go(next)} className={screen.primaryButton}>
              Next: {STEP_LABELS[next].toLowerCase()}
              <Icon name="chevron" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
