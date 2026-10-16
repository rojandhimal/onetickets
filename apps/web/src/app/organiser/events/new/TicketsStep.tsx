'use client';

import {
  EVENT_LIMITS,
  type EventDraftDto,
  type SalesEnd,
  type SalesStart,
  type TicketTypeDto,
  type TicketTypeInput,
  formatAud,
} from '@onetickets/shared';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import screen from '@/components/screen.module.css';
import { addTicketType, removeTicketType, updateTicketType } from '@/lib/events-client';
import { isSkippedTime, isoToWallClock, wallClockToIso } from '@/lib/zoned-time';
import styles from './wizard.module.css';

export type TicketSaveState = 'saved' | 'saving' | 'offline' | 'failed' | 'refused';

type SalesStartKind = SalesStart['kind'];
type SalesEndKind = SalesEnd['kind'];

export const CAPACITY_MIN_ERROR = 'Set at least 1 ticket';
export const SALES_END_BEFORE_START_ERROR = 'Sales need to end after they start';
export const TICKET_NAME_EMPTY_ERROR = 'Give this ticket a name';

const HOUR_MS = 60 * 60 * 1000;

export function maxPerOrderErrorText(capacity: number): string {
  return `Can't be more than ${capacity}, the number of tickets`;
}

export function ticketSummaryLine(
  ticket: Pick<TicketTypeDto, 'priceCents' | 'capacity' | 'maxPerOrder'>,
): string {
  const price = ticket.priceCents === 0 ? 'Free' : formatAud(ticket.priceCents);
  const count = `${ticket.capacity} ${ticket.capacity === 1 ? 'ticket' : 'tickets'}`;
  return `${price} · ${count} · up to ${ticket.maxPerOrder} per order`;
}

function resolveStartMs(start: SalesStart, event: EventDraftDto): number | null {
  if (start.kind === 'at') return Date.parse(start.at);
  return event.publishedAt ? Date.parse(event.publishedAt) : null;
}

function resolveEndMs(end: SalesEnd, event: EventDraftDto): number | null {
  switch (end.kind) {
    case 'at':
      return Date.parse(end.at);
    case 'event_end':
      return event.endsAt ? Date.parse(event.endsAt) : null;
    case 'event_start':
      return event.startsAt ? Date.parse(event.startsAt) : null;
    case 'hour_before':
      return event.startsAt ? Date.parse(event.startsAt) - HOUR_MS : null;
    case 'day_before':
      return event.startsAt ? Date.parse(event.startsAt) - 24 * HOUR_MS : null;
  }
}

function isWindowValid(start: SalesStart, end: SalesEnd, event: EventDraftDto): boolean {
  const from = resolveStartMs(start, event);
  const to = resolveEndMs(end, event);
  return from === null || to === null || to > from;
}

type DraftFields = {
  name: string;
  capacityText: string;
  maxPerOrderText: string;
  startKind: SalesStartKind;
  startDate: string;
  startTime: string;
  endKind: SalesEndKind;
  endDate: string;
  endTime: string;
};

function fieldsFromTicket(ticket: TicketTypeDto, tz: string): DraftFields {
  const startWall =
    ticket.salesStart.kind === 'at' ? isoToWallClock(ticket.salesStart.at, tz) : null;
  const endWall = ticket.salesEnd.kind === 'at' ? isoToWallClock(ticket.salesEnd.at, tz) : null;
  return {
    name: ticket.name,
    capacityText: String(ticket.capacity),
    maxPerOrderText: String(ticket.maxPerOrder),
    startKind: ticket.salesStart.kind,
    startDate: startWall?.date ?? '',
    startTime: startWall?.time ?? '09:00',
    endKind: ticket.salesEnd.kind,
    endDate: endWall?.date ?? '',
    endTime: endWall?.time ?? '17:00',
  };
}

function blankTicketFields(): DraftFields {
  return {
    name: '',
    capacityText: '20',
    maxPerOrderText: '10',
    startKind: 'on_publish',
    startDate: '',
    startTime: '09:00',
    endKind: 'event_start',
    endDate: '',
    endTime: '17:00',
  };
}

type ServerFieldErrors = Partial<
  Record<'name' | 'capacity' | 'maxPerOrder' | 'salesStart' | 'salesEnd', string>
>;

function parsePositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Artboard 8: free ticket types with ±5 stepper, sales window presets/custom dates, and summary rows. */
export function TicketsStep({
  event,
  headingRef,
  flushRef,
  onTicketChanged,
  onSaveStateChange,
}: {
  event: EventDraftDto;
  headingRef: RefObject<HTMLHeadingElement | null>;
  flushRef?: RefObject<(() => Promise<void>) | null>;
  onTicketChanged: (event: EventDraftDto) => void;
  onSaveStateChange?: (state: TicketSaveState) => void;
}) {
  const tz = event.timeZone;
  const firstTicket = event.ticketTypes[0];

  const [activeId, setActiveId] = useState<string>(firstTicket?.id ?? 'new');
  const [fields, setFields] = useState<DraftFields>(() =>
    firstTicket ? fieldsFromTicket(firstTicket, tz) : blankTicketFields(),
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<ServerFieldErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const eventRef = useRef(event);
  eventRef.current = event;
  const dirtyRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const reportState = useCallback(
    (state: TicketSaveState) => {
      onSaveStateChange?.(state);
    },
    [onSaveStateChange],
  );

  // Validate current fields and build a TicketTypeInput when valid.
  const evaluate = useCallback(
    (current: DraftFields, currentEvent: EventDraftDto, showUntouched: boolean) => {
      const trimmedName = current.name.trim();
      const cap = parsePositiveInt(current.capacityText);
      const maxOrd = parsePositiveInt(current.maxPerOrderText);

      const nameError =
        !trimmedName && (showUntouched || touched.name)
          ? TICKET_NAME_EMPTY_ERROR
          : (serverErrors.name ?? null);

      let capacityError: string | null = null;
      if (current.capacityText.trim() === '') {
        if (showUntouched || touched.capacity) capacityError = CAPACITY_MIN_ERROR;
      } else if (cap === null || cap < 1) {
        capacityError = CAPACITY_MIN_ERROR;
      } else if (cap > EVENT_LIMITS.capacity) {
        capacityError = `Keep it to ${EVENT_LIMITS.capacity.toLocaleString('en-AU')} tickets or fewer`;
      } else if (serverErrors.capacity) {
        capacityError = serverErrors.capacity;
      }

      let maxPerOrderError: string | null = null;
      if (current.maxPerOrderText.trim() === '') {
        if (showUntouched || touched.maxPerOrder) maxPerOrderError = CAPACITY_MIN_ERROR;
      } else if (maxOrd === null || maxOrd < 1) {
        maxPerOrderError = CAPACITY_MIN_ERROR;
      } else if (cap !== null && cap >= 1 && maxOrd > cap) {
        maxPerOrderError = maxPerOrderErrorText(cap);
      } else if (maxOrd > EVENT_LIMITS.maxPerOrder) {
        maxPerOrderError = `Can't be more than ${EVENT_LIMITS.maxPerOrder} per order`;
      } else if (serverErrors.maxPerOrder) {
        maxPerOrderError = serverErrors.maxPerOrder;
      }

      let salesStart: SalesStart | null = null;
      let startError: string | null = serverErrors.salesStart ?? null;
      if (current.startKind === 'on_publish') {
        salesStart = { kind: 'on_publish' };
      } else if (current.startDate && current.startTime) {
        salesStart = {
          kind: 'at',
          at: wallClockToIso(
            { date: current.startDate, time: current.startTime },
            currentEvent.timeZone,
          ),
        };
      } else if (showUntouched || touched.salesStart) {
        startError = 'Pick a start date and time';
      }

      let salesEnd: SalesEnd | null = null;
      let salesEndError: string | null = serverErrors.salesEnd ?? null;
      if (current.endKind !== 'at') {
        salesEnd = { kind: current.endKind };
      } else if (current.endDate && current.endTime) {
        salesEnd = {
          kind: 'at',
          at: wallClockToIso(
            { date: current.endDate, time: current.endTime },
            currentEvent.timeZone,
          ),
        };
      } else if (showUntouched || touched.salesEnd) {
        salesEndError = 'Pick an end date and time';
      }

      if (salesStart && salesEnd && !isWindowValid(salesStart, salesEnd, currentEvent)) {
        salesEndError = SALES_END_BEFORE_START_ERROR;
      }

      const hasClientError = !!(
        nameError ||
        capacityError ||
        maxPerOrderError ||
        startError ||
        salesEndError
      );

      const validInput: TicketTypeInput | null =
        !hasClientError &&
        trimmedName &&
        cap !== null &&
        cap >= 1 &&
        cap <= EVENT_LIMITS.capacity &&
        maxOrd !== null &&
        maxOrd >= 1 &&
        maxOrd <= cap &&
        maxOrd <= EVENT_LIMITS.maxPerOrder &&
        salesStart &&
        salesEnd
          ? {
              name: trimmedName,
              capacity: cap,
              maxPerOrder: maxOrd,
              priceCents: 0,
              salesStart,
              salesEnd,
            }
          : null;

      return {
        nameError,
        capacityError,
        maxPerOrderError,
        startError,
        salesEndError,
        hasClientError,
        validInput,
      };
    },
    [serverErrors, touched],
  );

  const sendSave = useCallback(async () => {
    for (let round = 0; round < 4 && dirtyRef.current; round++) {
      const check = evaluate(fieldsRef.current, eventRef.current, false);
      if (!check.validInput) {
        reportState(check.hasClientError ? 'refused' : 'saved');
        return;
      }
      dirtyRef.current = false;
      const targetId = activeIdRef.current;
      const prevIds = new Set(eventRef.current.ticketTypes.map((t) => t.id));
      reportState('saving');

      const result =
        targetId === 'new'
          ? await addTicketType(eventRef.current, check.validInput)
          : await updateTicketType(eventRef.current, targetId, check.validInput);

      if (result.ok) {
        setBannerError(null);
        eventRef.current = result.event;
        onTicketChanged(result.event);
        if (targetId === 'new') {
          const created =
            result.event.ticketTypes.find((t) => !prevIds.has(t.id)) ??
            result.event.ticketTypes.at(-1);
          if (created) {
            activeIdRef.current = created.id;
            setActiveId(created.id);
          }
        }
        continue;
      }

      if (result.kind === 'invalid') {
        const msg = mapServerErrorMessage(result.message, result.code, fieldsRef.current);
        const field = (result.field ??
          (result.code === 'sales_end_before_start'
            ? 'salesEnd'
            : result.code === 'max_per_order_over_capacity'
              ? 'maxPerOrder'
              : 'name')) as keyof ServerFieldErrors;
        setServerErrors((prev) => ({ ...prev, [field]: msg }));
        reportState('refused');
        return;
      }

      if (result.kind === 'conflict') {
        setBannerError(result.message);
        reportState('refused');
        return;
      }

      dirtyRef.current = true;
      const offline = result.kind === 'offline' || !navigator.onLine;
      reportState(offline ? 'offline' : 'failed');
      return;
    }
    reportState('saved');
  }, [evaluate, onTicketChanged, reportState]);

  const flush = useCallback(async () => {
    if (inFlightRef.current) await inFlightRef.current;
    if (!dirtyRef.current) return;
    const p = sendSave();
    inFlightRef.current = p;
    try {
      await p;
    } finally {
      if (inFlightRef.current === p) inFlightRef.current = null;
    }
  }, [sendSave]);

  useEffect(() => {
    if (flushRef) flushRef.current = flush;
    return () => {
      if (flushRef) flushRef.current = null;
    };
  }, [flush, flushRef]);

  function clearServerError(field: keyof ServerFieldErrors) {
    setServerErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateFields(patch: Partial<DraftFields>, saveImmediately = false) {
    const next = { ...fieldsRef.current, ...patch };
    fieldsRef.current = next;
    setFields(next);
    dirtyRef.current = true;
    const check = evaluate(next, eventRef.current, false);
    if (check.hasClientError) {
      reportState('refused');
      return;
    }
    if (saveImmediately && check.validInput) {
      void flush();
      return;
    }
    if (!inFlightRef.current) {
      reportState('saved');
    }
  }

  async function handleBlur(field: keyof ServerFieldErrors) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    const check = evaluate(fieldsRef.current, eventRef.current, true);
    if (check.hasClientError) {
      reportState('refused');
      return;
    }
    if (dirtyRef.current && check.validInput) {
      await flush();
    }
  }

  function stepCapacity(delta: number) {
    clearServerError('capacity');
    clearServerError('maxPerOrder');
    setTouched((prev) => ({ ...prev, capacity: true }));
    const current = parsePositiveInt(fieldsRef.current.capacityText) ?? 0;
    const nextCap = Math.min(EVENT_LIMITS.capacity, Math.max(1, current + delta));
    updateFields({ capacityText: String(nextCap) }, true);
  }

  async function selectTicket(id: string) {
    await flush();
    const target = eventRef.current.ticketTypes.find((t) => t.id === id);
    if (!target) return;
    setBannerError(null);
    setServerErrors({});
    setTouched({});
    dirtyRef.current = false;
    activeIdRef.current = id;
    setActiveId(id);
    const nextFields = fieldsFromTicket(target, eventRef.current.timeZone);
    fieldsRef.current = nextFields;
    setFields(nextFields);
    reportState('saved');
  }

  async function startNewTicket() {
    await flush();
    setBannerError(null);
    setServerErrors({});
    setTouched({});
    dirtyRef.current = false;
    activeIdRef.current = 'new';
    setActiveId('new');
    const nextFields = blankTicketFields();
    fieldsRef.current = nextFields;
    setFields(nextFields);
    queueMicrotask(() => nameInputRef.current?.focus());
  }

  async function handleRemove(id: string) {
    setBannerError(null);
    if (id === 'new') {
      dirtyRef.current = false;
      setServerErrors({});
      setTouched({});
      const fallback = eventRef.current.ticketTypes[0];
      if (fallback) {
        activeIdRef.current = fallback.id;
        setActiveId(fallback.id);
        const nextFields = fieldsFromTicket(fallback, eventRef.current.timeZone);
        fieldsRef.current = nextFields;
        setFields(nextFields);
      } else {
        const nextFields = blankTicketFields();
        fieldsRef.current = nextFields;
        setFields(nextFields);
      }
      reportState('saved');
      return;
    }

    reportState('saving');
    const result = await removeTicketType(eventRef.current, id);
    if (!result.ok) {
      if (result.kind === 'conflict' || result.kind === 'invalid') {
        setBannerError(result.message);
        reportState('refused');
      } else {
        const offline = result.kind === 'offline' || !navigator.onLine;
        reportState(offline ? 'offline' : 'failed');
      }
      return;
    }

    eventRef.current = result.event;
    onTicketChanged(result.event);
    reportState('saved');

    if (activeIdRef.current === id) {
      dirtyRef.current = false;
      setServerErrors({});
      setTouched({});
      const remaining = result.event.ticketTypes[0];
      if (remaining) {
        activeIdRef.current = remaining.id;
        setActiveId(remaining.id);
        const nextFields = fieldsFromTicket(remaining, result.event.timeZone);
        fieldsRef.current = nextFields;
        setFields(nextFields);
      } else {
        activeIdRef.current = 'new';
        setActiveId('new');
        const nextFields = blankTicketFields();
        fieldsRef.current = nextFields;
        setFields(nextFields);
      }
    }
  }

  const collapsedTypes = event.ticketTypes.filter((t) => t.id !== activeId);
  const activeTicket = event.ticketTypes.find((t) => t.id === activeId) ?? null;
  const { nameError, capacityError, maxPerOrderError, startError, salesEndError } = evaluate(
    fields,
    event,
    false,
  );

  const startSkipped = !!(
    fields.startKind === 'at' &&
    fields.startDate &&
    fields.startTime &&
    isSkippedTime({ date: fields.startDate, time: fields.startTime }, tz)
  );
  const endSkipped = !!(
    fields.endKind === 'at' &&
    fields.endDate &&
    fields.endTime &&
    isSkippedTime({ date: fields.endDate, time: fields.endTime }, tz)
  );

  const canRemoveActive =
    activeId === 'new'
      ? event.ticketTypes.length > 0
      : event.status === 'draft' || event.ticketTypes.length > 1;

  return (
    <main className={styles.body}>
      <div className={styles.heading}>
        <h1 ref={headingRef} tabIndex={-1}>
          Tickets
        </h1>
        <span className={styles.lede}>Your template added a free ticket type to start with.</span>
      </div>

      {bannerError && (
        <div role="alert" className={`${screen.notice} ${screen.noticeError}`}>
          <Icon name="alert" />
          <p>{bannerError}</p>
        </div>
      )}

      {collapsedTypes.length > 0 && (
        <ul className={styles.card} aria-label="Ticket types">
          {collapsedTypes.map((t) => (
            <li key={t.id} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowLabel}>{t.name}</span>
                <span className={styles.rowValue}>{ticketSummaryLine(t)}</span>
              </span>
              <div className={styles.ticketRowActions}>
                <button
                  type="button"
                  className={styles.ticketEditButton}
                  onClick={() => void selectTicket(t.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.ticketRemoveButton}
                  aria-label={`Remove ${t.name} ticket`}
                  disabled={t.sold > 0}
                  onClick={() => void handleRemove(t.id)}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section
        className={styles.ticketCard}
        aria-label={fields.name.trim() ? `${fields.name.trim()} ticket` : 'Ticket type'}
      >
        <div className={styles.ticketCardHeader}>
          <div className={styles.freeLine}>
            <span className={styles.tick}>
              <Icon name="check" size={16} />
            </span>
            <span>Free ticket. No fees for you or your guests.</span>
          </div>
          {canRemoveActive && (
            <button
              type="button"
              className={styles.ticketRemoveButton}
              aria-label={`Remove ${fields.name.trim() || activeTicket?.name || 'new'} ticket`}
              disabled={activeTicket ? activeTicket.sold > 0 : false}
              onClick={() => void handleRemove(activeId)}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="tt-name">Ticket name</label>
          <input
            ref={nameInputRef}
            id="tt-name"
            maxLength={EVENT_LIMITS.ticketTypeName}
            placeholder="For example, General admission"
            value={fields.name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'tt-name-error' : undefined}
            onChange={(e) => {
              clearServerError('name');
              updateFields({ name: e.target.value });
            }}
            onBlur={() => void handleBlur('name')}
          />
          <FieldError id="tt-name-error" message={nameError} />
        </div>

        <div className={styles.field}>
          <label htmlFor="tt-capacity">How many tickets?</label>
          <div className={styles.stepperRow}>
            <button
              type="button"
              className={styles.stepperButton}
              aria-label="5 fewer tickets"
              onClick={() => stepCapacity(-5)}
            >
              −5
            </button>
            <input
              id="tt-capacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={EVENT_LIMITS.capacity}
              value={fields.capacityText}
              aria-invalid={capacityError ? true : undefined}
              aria-describedby={
                capacityError ? 'tt-capacity-error tt-capacity-hint' : 'tt-capacity-hint'
              }
              onChange={(e) => {
                clearServerError('capacity');
                clearServerError('maxPerOrder');
                updateFields({ capacityText: e.target.value });
              }}
              onBlur={() => void handleBlur('capacity')}
            />
            <button
              type="button"
              className={styles.stepperButton}
              aria-label="5 more tickets"
              onClick={() => stepCapacity(5)}
            >
              +5
            </button>
          </div>
          <FieldError id="tt-capacity-error" message={capacityError} />
          <span id="tt-capacity-hint" className={styles.hint}>
            Your venue capacity
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="tt-max-per-order">Max per order</label>
          <input
            id="tt-max-per-order"
            type="number"
            inputMode="numeric"
            min={1}
            max={EVENT_LIMITS.maxPerOrder}
            value={fields.maxPerOrderText}
            aria-invalid={maxPerOrderError ? true : undefined}
            aria-describedby={maxPerOrderError ? 'tt-max-per-order-error' : undefined}
            onChange={(e) => {
              clearServerError('maxPerOrder');
              updateFields({ maxPerOrderText: e.target.value });
            }}
            onBlur={() => void handleBlur('maxPerOrder')}
          />
          <FieldError id="tt-max-per-order-error" message={maxPerOrderError} />
        </div>

        <div className={styles.field}>
          <label htmlFor="tt-sales-start">Sales start</label>
          <select
            id="tt-sales-start"
            value={fields.startKind}
            aria-invalid={startError ? true : undefined}
            aria-describedby={startError ? 'tt-sales-start-error' : undefined}
            onChange={(e) => {
              clearServerError('salesStart');
              clearServerError('salesEnd');
              const startKind = e.target.value as SalesStartKind;
              updateFields({ startKind }, startKind === 'on_publish');
            }}
            onBlur={() => void handleBlur('salesStart')}
          >
            <option value="on_publish">When I publish</option>
            <option value="at">Pick a date and time</option>
          </select>
          {fields.startKind === 'at' && (
            <div className={styles.when}>
              <div className={styles.field}>
                <label htmlFor="tt-start-date">Sales start date</label>
                <input
                  id="tt-start-date"
                  type="date"
                  value={fields.startDate}
                  aria-invalid={startError ? true : undefined}
                  aria-describedby={startError ? 'tt-sales-start-error' : undefined}
                  onChange={(e) => {
                    clearServerError('salesStart');
                    clearServerError('salesEnd');
                    updateFields({ startDate: e.target.value });
                  }}
                  onBlur={() => void handleBlur('salesStart')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="tt-start-time">Sales start time</label>
                <input
                  id="tt-start-time"
                  type="time"
                  value={fields.startTime}
                  aria-invalid={startError ? true : undefined}
                  aria-describedby={
                    startError
                      ? 'tt-sales-start-error'
                      : startSkipped
                        ? 'tt-start-skipped'
                        : undefined
                  }
                  onChange={(e) => {
                    clearServerError('salesStart');
                    clearServerError('salesEnd');
                    updateFields({ startTime: e.target.value });
                  }}
                  onBlur={() => void handleBlur('salesStart')}
                />
                {startSkipped && (
                  <span id="tt-start-skipped" className={styles.hint}>
                    Clocks go forward then; we&apos;ll use the next valid time.
                  </span>
                )}
              </div>
            </div>
          )}
          <FieldError id="tt-sales-start-error" message={startError} />
        </div>

        <div className={styles.field}>
          <label htmlFor="tt-sales-end">Sales end</label>
          <select
            id="tt-sales-end"
            value={fields.endKind}
            aria-invalid={salesEndError ? true : undefined}
            aria-describedby={salesEndError ? 'tt-sales-end-error' : undefined}
            onChange={(e) => {
              clearServerError('salesEnd');
              const endKind = e.target.value as SalesEndKind;
              updateFields({ endKind }, endKind !== 'at');
            }}
            onBlur={() => void handleBlur('salesEnd')}
          >
            <option value="event_start">At start time</option>
            <option value="hour_before">1 hour before</option>
            <option value="day_before">1 day before</option>
            <option value="event_end">When the event ends</option>
            <option value="at">Pick a date and time</option>
          </select>
          {fields.endKind === 'at' && (
            <div className={styles.when}>
              <div className={styles.field}>
                <label htmlFor="tt-end-date">Sales end date</label>
                <input
                  id="tt-end-date"
                  type="date"
                  value={fields.endDate}
                  aria-invalid={salesEndError ? true : undefined}
                  aria-describedby={salesEndError ? 'tt-sales-end-error' : undefined}
                  onChange={(e) => {
                    clearServerError('salesEnd');
                    updateFields({ endDate: e.target.value });
                  }}
                  onBlur={() => void handleBlur('salesEnd')}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="tt-end-time">Sales end time</label>
                <input
                  id="tt-end-time"
                  type="time"
                  value={fields.endTime}
                  aria-invalid={salesEndError ? true : undefined}
                  aria-describedby={
                    salesEndError ? 'tt-sales-end-error' : endSkipped ? 'tt-end-skipped' : undefined
                  }
                  onChange={(e) => {
                    clearServerError('salesEnd');
                    updateFields({ endTime: e.target.value });
                  }}
                  onBlur={() => void handleBlur('salesEnd')}
                />
                {endSkipped && (
                  <span id="tt-end-skipped" className={styles.hint}>
                    Clocks go forward then; we&apos;ll use the next valid time.
                  </span>
                )}
              </div>
            </div>
          )}
          <FieldError id="tt-sales-end-error" message={salesEndError} />
        </div>
      </section>

      <div className={styles.addTypeBlock}>
        <button
          type="button"
          className={styles.addTypeButton}
          onClick={() => void startNewTicket()}
        >
          <Icon name="plus" size={18} />
          Add another ticket type
        </button>
        <span className={styles.hint}>
          For example members, kids or a group of four. Each type has its own number of tickets.
        </span>
      </div>
    </main>
  );
}

function mapServerErrorMessage(
  message: string,
  code: string | undefined,
  fields: DraftFields,
): string {
  if (code === 'sales_end_before_start' || message === 'sales_end_before_start') {
    return SALES_END_BEFORE_START_ERROR;
  }
  if (code === 'max_per_order_over_capacity' || message === 'max_per_order_over_capacity') {
    const cap = parsePositiveInt(fields.capacityText);
    return cap !== null && cap >= 1 ? maxPerOrderErrorText(cap) : CAPACITY_MIN_ERROR;
  }
  if (/^[a-z_]+$/.test(message)) {
    return 'Check this and try again.';
  }
  return message;
}

function FieldError({ id, message }: { id: string | undefined; message: string | null }) {
  if (!message) return null;
  return (
    <span id={id} className={styles.fieldError}>
      <Icon name="alert" size={16} />
      {message}
    </span>
  );
}
