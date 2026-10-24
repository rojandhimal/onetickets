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

interface TypeAvailability {
  onSale: boolean;
  spotsLeft: number;
  soldOut: boolean;
}

/**
 * Whether an event is sold out and how many spots it has left, both counted over the types on
 * sale now. With nothing on sale (before sales open or after they close), every type counts.
 */
export function eventAvailability(types: TypeAvailability[]): {
  spotsLeft: number;
  soldOut: boolean;
} {
  const onSaleTypes = types.filter((t) => t.onSale);
  const counted = onSaleTypes.length > 0 ? onSaleTypes : types;
  return {
    spotsLeft: counted.reduce((sum, t) => sum + t.spotsLeft, 0),
    soldOut: counted.length > 0 && counted.every((t) => t.soldOut),
  };
}
