/**
 * The one place prices shown to buyers are worked out (QA 5.6). The web never computes a price.
 *
 * All prices are integer cents. Every ticket is free until paid tickets arrive in Sprint 4, when
 * the booking and processing fees are added here, so a buyer always sees the price they pay.
 */

/** What a buyer pays for one ticket, fees included. */
export function allInPriceCents(priceCents: number): number {
  return priceCents;
}

/**
 * The "from" price on a browse card and the event page: the cheapest all-in price among the
 * event's ticket types, or 0 with none. It is free exactly when some ticket type costs nothing,
 * which is what browse's `price=free` filter matches in SQL.
 */
export function fromPriceCents(priceCents: readonly number[]): number {
  return priceCents.length === 0 ? 0 : Math.min(...priceCents.map(allInPriceCents));
}
