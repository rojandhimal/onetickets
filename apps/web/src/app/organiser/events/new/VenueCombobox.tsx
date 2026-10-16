'use client';

import type { PlaceSuggestionDto, VenueInput } from '@onetickets/shared';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { getPlace, searchPlaces } from '@/lib/events-client';
import styles from './wizard.module.css';

type Place = Extract<VenueInput, { kind: 'place' }>;

export const MIN_QUERY = 3;
const DEBOUNCE_MS = 250;

/** Address lookup on artboard 7: an ARIA 1.2 combobox with a list of suggestions. */
export function VenueCombobox({
  value,
  serverError = null,
  onChange,
  onBlur,
  onLookup,
}: {
  value: Place | null;
  /** The api refused the venue (422); shown until the organiser picks again. */
  serverError?: string | null;
  onChange: (venue: Place | null) => void;
  onBlur: () => void;
  /** Picking a suggestion looks the place up before it can be saved; this resolves after. */
  onLookup?: (done: Promise<void>) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState(value ? `${value.name}, ${value.suburb}` : '');
  const [items, setItems] = useState<PlaceSuggestionDto[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [localError, setError] = useState<string | null>(null);
  const error = localError ?? serverError;
  const searchFor = useRef<string | null>(null);

  useEffect(() => {
    const q = searchFor.current;
    if (q === null || q.trim().length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const found = await searchPlaces(q.trim(), controller.signal);
      if (controller.signal.aborted) return;
      if (found === null) {
        setError("We couldn't look up addresses. Check your connection.");
        return;
      }
      setError(null);
      setItems(found);
      setActive(found.length ? 0 : -1);
      setOpen(true);
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function type(text: string) {
    searchFor.current = text;
    setQuery(text);
    setError(null);
    if (value) onChange(null);
    if (text.trim().length < MIN_QUERY) {
      setOpen(false);
      setItems([]);
    }
  }

  async function choose(item: PlaceSuggestionDto) {
    searchFor.current = null;
    setOpen(false);
    setQuery(item.name);
    const done = (async () => {
      const place = await getPlace(item.placeId);
      if (place?.kind !== 'place') {
        setError("We couldn't load that address. Try again.");
        return;
      }
      setQuery(`${place.name}, ${place.suburb}`);
      onChange(place);
    })();
    onLookup?.(done);
    await done;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (e.key === 'Enter' && open && items[active]) {
      e.preventDefault();
      void choose(items[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const expanded = open && items.length > 0;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>Venue address</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        autoComplete="off"
        maxLength={100}
        value={query}
        onChange={(e) => type(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          if (query.trim() && !value)
            setError('Pick an address from the list so people can find it');
          onBlur();
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Address suggestions"
        className={styles.listbox}
        hidden={!expanded}
      >
        {items.map((item, i) => (
          <li
            key={item.placeId}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={styles.option}
            // Keep focus in the input so the list doesn't close before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void choose(item)}
          >
            <strong>{item.name}</strong>
            <span>{item.address}</span>
          </li>
        ))}
      </ul>
      <span role="status" className="visually-hidden">
        {open
          ? items.length
            ? `${items.length} suggestion${items.length === 1 ? '' : 's'}`
            : 'No matching addresses'
          : ''}
      </span>
      {error && (
        <span id={errorId} className={styles.fieldError}>
          <Icon name="alert" size={16} />
          {error}
        </span>
      )}
      <span id={hintId} className={styles.hint}>
        {value
          ? value.address
          : 'Use the up and down arrows to pick a suggestion, Enter to choose.'}
      </span>
    </div>
  );
}
