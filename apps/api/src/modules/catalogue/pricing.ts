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
 * ticket types on sale now, or among all of them when none is (before sales open, or after they
 * close), so an early bird that has finished stops pulling the price down. 0 with no types.
 */
export function fromPriceCents(types: readonly { priceCents: number; onSale: boolean }[]): number {
  const onSale = types.filter((t) => t.onSale);
  const counted = onSale.length > 0 ? onSale : types;
  return counted.length === 0 ? 0 : Math.min(...counted.map((t) => allInPriceCents(t.priceCents)));
}
