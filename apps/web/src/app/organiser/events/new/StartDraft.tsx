'use client';

import type { EventDraftDto } from '@onetickets/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { createEvent, saveDraft } from '@/lib/events-client';
import { STARTER_ABOUT } from '@/lib/templates';
import { stepHref } from '@/lib/wizard-model';

export function StartDraft({
  organisationId,
  template,
}: {
  organisationId: string;
  template: EventDraftDto['template'];
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const start = useCallback(async () => {
    setFailed(false);
    const result = await createEvent(organisationId, template);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    // The template's starter About (S1-4). If this save fails the draft simply starts without it.
    const about = STARTER_ABOUT[template];
    if (about && !result.event.about) {
      await saveDraft(result.event, { version: result.event.version, about });
    }
    router.replace(stepHref('basics', result.event.id));
  }, [organisationId, router, template]);

  useEffect(() => {
    // Strict mode runs effects twice in development; one draft per visit.
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  return (
    <main className={screen.main} aria-busy={!failed}>
      {failed ? (
        <>
          <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
            <Icon name="alert" />
            <p>We couldn&apos;t start your event. Check your connection and try again.</p>
          </div>
          <button type="button" className={screen.primaryButton} onClick={() => void start()}>
            Try again
          </button>
          <a href="/organiser" className={screen.textButton}>
            Back to your events
          </a>
        </>
      ) : (
        <p role="status" className={screen.text}>
          Starting your event…
        </p>
      )}
    </main>
  );
}
