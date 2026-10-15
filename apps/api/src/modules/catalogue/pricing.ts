/**
 * The one place prices shown to buyers are worked out (QA 5.6). The web never computes a price.
 *
 * All prices are integer cents. Which ticket types the "from" price counts is decided in one SQL
 * function, catalogue.from_price_cents() (migration 0006), so browse's free/paid filter, browse
 * cards and the event page always agree. Fees are added here: every ticket is free until paid
 * tickets arrive in Sprint 4, when the booking and processing fees join allInPriceCents().
 */

/** What a buyer pays for one ticket, fees included. Never turns a free ticket into a paid one. */
export function allInPriceCents(priceCents: number): number {
  return priceCents;
}
