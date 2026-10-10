'use client';

import type { EventDraftDto, VenueInput } from '@onetickets/shared';
import { type RefObject, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { PendingChanges } from '@/lib/draft-store';
import { placeLine } from '@/lib/wizard-model';
import { eventEyebrow, isoToWallClock, nextDay, wallClockToIso } from '@/lib/zoned-time';
import { VenueCombobox } from './VenueCombobox';
import styles from './wizard.module.css';

const TEMPLATE_NAMES: Record<EventDraftDto['template'], string> = {
  workshop: 'Workshop',
  gig: 'Gig',
  school_night: 'School night',
  meetup: 'Meetup',
  blank: 'blank',
};

export const EVENT_NAME_MAX = 120;

type Place = Extract<VenueInput, { kind: 'place' }>;
type Mode = 'place' | 'online';

function isHttpsUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && !!url.hostname;
  } catch {
    return false;
  }
}

/** Artboard 7: name, date and times, and where. Every change autosaves; nothing blocks typing. */
export function BasicsStep({
  event,
  headingRef,
  onChange,
  onBlur,
}: {
  event: EventDraftDto;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: (changes: PendingChanges) => void;
  onBlur: () => void;
}) {
  const tz = event.timeZone;
  const start = event.startsAt ? isoToWallClock(event.startsAt, tz) : null;
  const end = event.endsAt ? isoToWallClock(event.endsAt, tz) : null;

  const [name, setName] = useState(event.name ?? '');
  const [date, setDate] = useState(start?.date ?? '');
  const [startTime, setStartTime] = useState(start?.time ?? '');
  const [endTime, setEndTime] = useState(end?.time ?? '');
  const [mode, setMode] = useState<Mode>(event.venue?.kind ?? 'place');
  const [place, setPlace] = useState<Place | null>(
    event.venue?.kind === 'place' ? event.venue : null,
  );
  const [url, setUrl] = useState(event.venue?.kind === 'online' ? event.venue.url : '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  // Today where the event happens, so a late-night organiser in Perth isn't told Sydney's date.
  const today = isoToWallClock(new Date().toISOString(), tz).date;

  function changeName(text: string) {
    setName(text);
    onChange({ name: text.trim() ? text.trim() : null });
  }

  function changeWhen(next: { date?: string; start?: string; end?: string }) {
    const d = next.date ?? date;
    const s = next.start ?? startTime;
    const e = next.end ?? endTime;
    if (next.date !== undefined) setDate(d);
    if (next.start !== undefined) setStartTime(s);
    if (next.end !== undefined) setEndTime(e);
    if (!d || !s) {
      onChange({ startsAt: null, endsAt: null });
      return;
    }
    // An end time at or before the start means the event runs past midnight.
    const endDate = e && e <= s ? nextDay(d) : d;
    onChange({
      startsAt: wallClockToIso({ date: d, time: s }, tz),
      endsAt: e ? wallClockToIso({ date: endDate, time: e }, tz) : null,
    });
  }

  function pickMode(next: Mode) {
    setMode(next);
    if (next === 'place') onChange({ venue: place });
    else onChange({ venue: isHttpsUrl(url) ? { kind: 'online', url } : null });
  }

  function changePlace(next: Place | null) {
    setPlace(next);
    onChange({ venue: next });
    if (next) onBlur();
  }

  function changeUrl(text: string) {
    setUrl(text);
    if (urlError && isHttpsUrl(text.trim())) setUrlError(null);
    onChange({ venue: isHttpsUrl(text.trim()) ? { kind: 'online', url: text.trim() } : null });
  }

  function checkUrl() {
    const text = url.trim();
    setUrlError(text && !isHttpsUrl(text) ? 'Enter a link that starts with https://' : null);
    onBlur();
  }

  const overnight = !!(startTime && endTime && endTime <= startTime);
  const previewVenue: VenueInput | null =
    mode === 'place' ? place : isHttpsUrl(url.trim()) ? { kind: 'online', url } : null;
  const startsAt = date && startTime ? wallClockToIso({ date, time: startTime }, tz) : null;

  return (
    <main className={styles.body}>
      <div className={styles.heading}>
        <h1 ref={headingRef} tabIndex={-1}>
          What&apos;s on?
        </h1>
        <span className={styles.lede}>
          {event.template === 'blank'
            ? 'Starting from a blank event. You can change anything later.'
            : `Using the ${TEMPLATE_NAMES[event.template]} template. You can change anything later.`}
        </span>
      </div>

      <div className={styles.field}>
        <label htmlFor="ev-name">Event name</label>
        <input
          id="ev-name"
          maxLength={EVENT_NAME_MAX}
          value={name}
          onChange={(e) => changeName(e.target.value)}
          onBlur={onBlur}
        />
      </div>

      <div className={styles.when}>
        <div className={`${styles.field} ${styles.whenDate}`}>
          <label htmlFor="ev-date">Date</label>
          <input
            id="ev-date"
            type="date"
            value={date}
            min={today}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? 'ev-date-error' : undefined}
            onChange={(e) => {
              if (dateError && e.target.value >= today) setDateError(null);
              changeWhen({ date: e.target.value });
            }}
            onBlur={() => {
              setDateError(date && date < today ? 'Pick a date from today on' : null);
              onBlur();
            }}
          />
          {dateError && (
            <span id="ev-date-error" className={styles.fieldError}>
              <Icon name="alert" size={16} />
              {dateError}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="ev-start">Starts</label>
          <input
            id="ev-start"
            type="time"
            value={startTime}
            onChange={(e) => changeWhen({ start: e.target.value })}
            onBlur={onBlur}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="ev-end">Ends</label>
          <input
            id="ev-end"
            type="time"
            value={endTime}
            aria-describedby={overnight ? 'ev-end-hint' : undefined}
            onChange={(e) => changeWhen({ end: e.target.value })}
            onBlur={onBlur}
          />
          {overnight && (
            <span id="ev-end-hint" className={styles.hint}>
              Ends the next day
            </span>
          )}
        </div>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Where</legend>
        <div className={styles.segmented}>
          <button
            type="button"
            className={styles.segment}
            aria-pressed={mode === 'place'}
            onClick={() => pickMode('place')}
          >
            In person
          </button>
          <button
            type="button"
            className={styles.segment}
            aria-pressed={mode === 'online'}
            onClick={() => pickMode('online')}
          >
            Online
          </button>
        </div>
        {mode === 'place' ? (
          <VenueCombobox value={place} onChange={changePlace} onBlur={onBlur} />
        ) : (
          <div className={styles.field}>
            <label htmlFor="ev-link">Link for attendees</label>
            <input
              id="ev-link"
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={2048}
              value={url}
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? 'ev-link-error ev-link-hint' : 'ev-link-hint'}
              onChange={(e) => changeUrl(e.target.value)}
              onBlur={checkUrl}
            />
            {urlError && (
              <span id="ev-link-error" className={styles.fieldError}>
                <Icon name="alert" size={16} />
                {urlError}
              </span>
            )}
            <span id="ev-link-hint" className={styles.hint}>
              Only people with a ticket see this link.
            </span>
          </div>
        )}
      </fieldset>

      {/* Repeats the fields above for sighted organisers, so screen readers skip it. */}
      <section className={styles.preview} aria-hidden="true">
        <span className={styles.previewLabel}>How attendees will see it</span>
        <div className={styles.previewCard}>
          <div className={`${styles.previewTile} ${styles[event.template]}`}>
            {event.template === 'blank' ? 'Event' : TEMPLATE_NAMES[event.template]}
          </div>
          <div className={styles.previewText}>
            <span className={styles.eyebrow}>
              {startsAt ? (
                eventEyebrow(startsAt, tz)
              ) : (
                <span className={styles.placeholder}>Date to come</span>
              )}
            </span>
            <span className={styles.previewTitle}>
              {name.trim() || <span className={styles.placeholder}>Your event name</span>}
            </span>
            <span className={styles.previewPlace}>
              {placeLine({ venue: previewVenue }) || 'Venue to be added'}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
