'use client';

import type { EventDraftDto, VenueInput } from '@onetickets/shared';
import { type RefObject, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { PendingChanges } from '@/lib/draft-store';
import { placeLine } from '@/lib/wizard-model';
import {
  eventEyebrow,
  isSkippedTime,
  isoToWallClock,
  nextDay,
  wallClockToIso,
} from '@/lib/zoned-time';
import { BannerField } from './BannerField';
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

/** Template examples for the name field (handoff S1-1); the label carries the meaning. */
export const NAME_PLACEHOLDERS: Record<EventDraftDto['template'], string> = {
  workshop: 'For example, Screen printing for beginners',
  gig: 'For example, The Lulus live at the Vic',
  school_night: 'For example, Trivia night for the P&C',
  meetup: 'For example, Inner west sketch club',
  blank: 'For example, Saturday market stall',
};

type Place = Extract<VenueInput, { kind: 'place' }>;
type Mode = 'place' | 'online';

/** Messages from the api for fields it refused (422), keyed by patch field. */
export type ServerErrors = Partial<
  Record<
    'name' | 'startsAt' | 'endsAt' | 'venue' | 'about' | 'accessibility' | 'contactEmail',
    string
  >
>;

export const END_SAME_AS_START = 'End time needs to be after the start';
export const ONLINE_LINK_ERROR = 'Add the full link, starting with https://';

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
  serverErrors = {},
  onChange,
  onBlur,
  onBannerChanged,
  onLookup,
}: {
  event: EventDraftDto;
  headingRef: RefObject<HTMLHeadingElement | null>;
  serverErrors?: ServerErrors;
  onChange: (changes: PendingChanges) => void;
  onBlur: () => void;
  onBannerChanged: (event: EventDraftDto) => void;
  onLookup?: (done: Promise<void>) => void;
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
    // An end time before the start means the event runs past midnight. The same time as the
    // start is a mistake, not a 24-hour event, so no end is saved until it's fixed.
    const endDate = e && e < s ? nextDay(d) : d;
    onChange({
      startsAt: wallClockToIso({ date: d, time: s }, tz),
      endsAt: e && e !== s ? wallClockToIso({ date: endDate, time: e }, tz) : null,
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
    setUrlError(text && !isHttpsUrl(text) ? ONLINE_LINK_ERROR : null);
    onBlur();
  }

  const overnight = !!(startTime && endTime && endTime < startTime);
  const sameTime = !!(startTime && endTime && endTime === startTime);
  const endError = sameTime ? END_SAME_AS_START : (serverErrors.endsAt ?? null);
  const nameError = serverErrors.name ?? null;
  const whenError = serverErrors.startsAt ?? null;
  const venueError = serverErrors.venue ?? null;
  const previewVenue: VenueInput | null =
    mode === 'place' ? place : isHttpsUrl(url.trim()) ? { kind: 'online', url } : null;
  const startsAt = date && startTime ? wallClockToIso({ date, time: startTime }, tz) : null;
  const startSkipped = !!(date && startTime && isSkippedTime({ date, time: startTime }, tz));

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

      <BannerField
        event={event}
        onUploaded={onBannerChanged}
        onFocusChange={(bannerFocus) => {
          onChange({ bannerFocus });
          onBlur();
        }}
      />

      <div className={styles.field}>
        <label htmlFor="ev-name">Event name</label>
        <input
          id="ev-name"
          maxLength={EVENT_NAME_MAX}
          placeholder={NAME_PLACEHOLDERS[event.template]}
          value={name}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'ev-name-error' : undefined}
          onChange={(e) => changeName(e.target.value)}
          onBlur={onBlur}
        />
        <FieldError id="ev-name-error" message={nameError} />
      </div>

      <div className={styles.when}>
        <div className={`${styles.field} ${styles.whenDate}`}>
          <label htmlFor="ev-date">Date</label>
          <input
            id="ev-date"
            type="date"
            value={date}
            min={today}
            aria-invalid={dateError || whenError ? true : undefined}
            aria-describedby={dateError || whenError ? 'ev-date-error' : undefined}
            onChange={(e) => {
              if (dateError && e.target.value >= today) setDateError(null);
              changeWhen({ date: e.target.value });
            }}
            onBlur={() => {
              setDateError(date && date < today ? 'Pick a date from today on' : null);
              onBlur();
            }}
          />
          <FieldError id="ev-date-error" message={dateError ?? whenError} />
        </div>
        <div className={styles.field}>
          <label htmlFor="ev-start">Starts</label>
          <input
            id="ev-start"
            type="time"
            value={startTime}
            aria-describedby={startSkipped ? 'ev-start-hint' : undefined}
            onChange={(e) => changeWhen({ start: e.target.value })}
            onBlur={onBlur}
          />
          {startSkipped && (
            <span id="ev-start-hint" className={styles.hint}>
              {skippedHint(startTime, startsAt!, tz)}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="ev-end">Ends</label>
          <input
            id="ev-end"
            type="time"
            value={endTime}
            aria-invalid={endError ? true : undefined}
            aria-describedby={endError ? 'ev-end-error' : overnight ? 'ev-end-hint' : undefined}
            onChange={(e) => changeWhen({ end: e.target.value })}
            onBlur={onBlur}
          />
          <FieldError id="ev-end-error" message={endError} />
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
          <VenueCombobox
            value={place}
            serverError={venueError}
            onChange={changePlace}
            onBlur={onBlur}
            onLookup={onLookup}
          />
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
              aria-invalid={urlError || venueError ? true : undefined}
              aria-describedby={
                urlError || venueError ? 'ev-link-error ev-link-hint' : 'ev-link-hint'
              }
              onChange={(e) => changeUrl(e.target.value)}
              onBlur={checkUrl}
            />
            <FieldError id="ev-link-error" message={urlError ?? venueError} />
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

/** "2:30 am doesn't happen that day because the clocks go forward. We'll use 3:30 am." */
function skippedHint(typed: string, resolvedIso: string, tz: string): string {
  const say = (hhmm: string) => {
    const [h = 0, m = 0] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  };
  const used = isoToWallClock(resolvedIso, tz).time;
  return `${say(typed)} doesn't happen that day because the clocks go forward. We'll use ${say(used)}.`;
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
