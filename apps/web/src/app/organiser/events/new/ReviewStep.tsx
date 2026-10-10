'use client';

import type { EventDraftDto } from '@onetickets/shared';
import { type MouseEvent, type RefObject, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { publishEvent } from '@/lib/events-client';
import {
  type Requirement,
  type WizardStep,
  missingMessage,
  missingRequirements,
  niceToHave,
  placeLine,
  publishChecklist,
  stepHref,
} from '@/lib/wizard-model';
import { eventEyebrow } from '@/lib/zoned-time';
import styles from './wizard.module.css';

/** Artboard 8c. The Publish button is never disabled; pressing it explains what's missing. */
export function ReviewStep({
  event,
  headingRef,
  flush,
  goTo,
  onPublished,
}: {
  event: EventDraftDto;
  headingRef: RefObject<HTMLHeadingElement | null>;
  flush: () => Promise<void>;
  goTo: (step: WizardStep) => (e?: MouseEvent) => void;
  onPublished: (event: EventDraftDto) => void;
}) {
  const [blocked, setBlocked] = useState<{ missing: Requirement[]; fromApi: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = publishChecklist(event);
  const extras = niceToHave(event);
  const missingNow = missingRequirements(event);
  // Our own check follows the organiser's edits, so the notice goes once they fix things. The
  // api's answer wins when it disagrees (say a ticket type was removed in another tab).
  const showBlocked = !blocked
    ? null
    : blocked.fromApi
      ? blocked.missing
      : missingNow.length
        ? missingNow
        : null;

  function block(missing: Requirement[], fromApi: boolean) {
    setBlocked({ missing, fromApi });
    listRef.current?.focus();
  }

  async function publish() {
    if (publishing) return;
    setFailed(false);
    setBlocked(null);
    if (missingNow.length) {
      block(missingNow, false);
      return;
    }
    setPublishing(true);
    await flush();
    const result = await publishEvent(event);
    setPublishing(false);
    if (result.ok) onPublished(result.event);
    else if (result.kind === 'not-ready') block(result.missing, true);
    else setFailed(true);
  }

  const place = placeLine(event);

  return (
    <>
      <main className={styles.body}>
        <div className={styles.heading}>
          <h1 ref={headingRef} tabIndex={-1}>
            Check and publish
          </h1>
        </div>

        {showBlocked && (
          <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
            <Icon name="alert" />
            <p>
              <strong>{missingMessage(showBlocked)}</strong> Everything else is ready.
            </p>
          </div>
        )}
        {failed && (
          <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
            <Icon name="alert" />
            <p>We couldn&apos;t publish your event. Check your connection and try again.</p>
          </div>
        )}

        <section aria-label="Preview" className={styles.previewCard}>
          <div className={`${styles.previewTile} ${styles[event.template]}`} aria-hidden="true" />
          <div className={styles.previewText}>
            {event.startsAt && (
              <span className={styles.eyebrow}>{eventEyebrow(event.startsAt, event.timeZone)}</span>
            )}
            <span className={styles.previewTitle}>{event.name ?? 'Untitled event'}</span>
            <span className={styles.previewPlace}>{place || 'Venue to be added'}</span>
            <strong>Free</strong>
          </div>
        </section>

        <section aria-labelledby="need-h" className={styles.section}>
          <h2 id="need-h">Needed to publish</h2>
          <ul ref={listRef} tabIndex={-1} className={styles.card} aria-labelledby="need-h">
            {rows.map((row) => {
              const action = row.done ? 'Edit' : 'Add';
              return (
                <li key={row.requirement} className={styles.row}>
                  {row.done ? (
                    <span className={styles.tick}>
                      <Icon name="check" />
                    </span>
                  ) : (
                    <span className={styles.alertIcon}>
                      <Icon name="alert" />
                    </span>
                  )}
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>
                      <span className="visually-hidden">{row.done ? 'Done: ' : 'Missing: '}</span>
                      {row.label}
                    </span>
                    <span className={`${styles.rowValue} ${row.done ? '' : styles.rowMissing}`}>
                      {row.value}
                    </span>
                  </span>
                  <a
                    href={stepHref(row.step, event.id)}
                    onClick={goTo(row.step)}
                    className={styles.rowAction}
                    aria-label={`${action} ${row.label.toLowerCase()}`}
                  >
                    {action}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="opt-h" className={styles.section}>
          <h2 id="opt-h">Nice to have</h2>
          <ul className={styles.card} aria-labelledby="opt-h">
            {extras.map((row) => (
              <li key={row.label} className={styles.row}>
                <span className={row.done ? styles.tick : styles.todo}>
                  <Icon name={row.done ? 'check' : 'circle'} />
                </span>
                <span className={styles.rowText}>
                  <span>
                    <span className="visually-hidden">{row.done ? 'Done: ' : 'Not added: '}</span>
                    {row.label}
                  </span>
                </span>
                <a
                  href={stepHref(row.step, event.id)}
                  onClick={goTo(row.step)}
                  className={styles.rowAction}
                  aria-label={`Edit ${row.label.toLowerCase()}`}
                >
                  Edit
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <div className={styles.footer}>
        <div className={styles.footerInner}>
          <button
            type="button"
            className={screen.primaryButton}
            onClick={() => void publish()}
            aria-busy={publishing || undefined}
          >
            {publishing ? (
              <>
                <span className={screen.spinner} aria-hidden="true" />
                Publishing…
              </>
            ) : (
              'Publish event'
            )}
          </button>
          <span className={styles.footerNote}>
            You can edit the event after it&apos;s live. We&apos;ll email anyone booked about big
            changes.
          </span>
        </div>
      </div>
    </>
  );
}
