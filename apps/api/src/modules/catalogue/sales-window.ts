import type { SalesEnd, SalesStart } from '@onetickets/shared';

const HOUR = 60 * 60 * 1000;

export interface EventTimes {
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
}

/** When a ticket type goes on sale, or null if that isn't known yet (an unpublished draft). */
export function salesStartsAt(start: SalesStart, event: EventTimes): Date | null {
  return start.kind === 'at' ? new Date(start.at) : event.publishedAt;
}

/** When a ticket type stops selling, or null if the event's times aren't set yet. */
export function salesEndsAt(end: SalesEnd, event: EventTimes): Date | null {
  switch (end.kind) {
    case 'at':
      return new Date(end.at);
    case 'event_end':
      return event.endsAt;
    case 'event_start':
      return event.startsAt;
    case 'hour_before':
      return event.startsAt && new Date(event.startsAt.getTime() - HOUR);
    case 'day_before':
      return event.startsAt && new Date(event.startsAt.getTime() - 24 * HOUR);
  }
}

/** False only when both ends are known and the window is empty. */
export function windowIsValid(start: SalesStart, end: SalesEnd, event: EventTimes): boolean {
  const from = salesStartsAt(start, event);
  const to = salesEndsAt(end, event);
  return !from || !to || to > from;
}

export function onSale(start: SalesStart, end: SalesEnd, event: EventTimes, now: Date): boolean {
  if (!event.publishedAt) return false;
  const from = salesStartsAt(start, event);
  const to = salesEndsAt(end, event);
  return !!from && !!to && from <= now && now < to;
}
