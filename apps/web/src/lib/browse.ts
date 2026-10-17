import {
  BROWSE_WHEN,
  CITIES,
  type BrowseCardDto,
  type BrowseQuery,
  type City,
  formatAud,
} from '@onetickets/shared';
import { eventEyebrow } from './zoned-time';

// Wording and filter helpers for public browse (S1-5, design artboard 1, copy-s0-s2.md).

export type BrowseWhen = (typeof BROWSE_WHEN)[number];
export type BrowsePrice = NonNullable<BrowseQuery['price']>;

export type BrowseFilters = {
  city: City;
  when?: BrowseWhen;
  price?: BrowsePrice;
};

export const CITY_LABELS: Record<City, string> = {
  sydney: 'Sydney',
  melbourne: 'Melbourne',
};

export const WHEN_OPTIONS: ReadonlyArray<{ id: BrowseWhen; label: string }> = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'this_weekend', label: 'This weekend' },
  { id: 'next_7_days', label: 'Next 7 days' },
];

export const PRICE_OPTIONS: ReadonlyArray<{ id: BrowsePrice; label: string }> = [
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
];

export const BROWSE_HEADINGS: Record<BrowseWhen | 'all', string> = {
  all: 'Coming up near you',
  tonight: 'On tonight',
  this_weekend: 'This weekend',
  next_7_days: 'Next 7 days',
};

export const BROWSE_NOTE = 'Prices shown are what you pay. No fees added later.';
export const BROWSE_EMPTY = 'Nothing on for that yet. Try Next 7 days.';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isCity(value: string | undefined): value is City {
  return !!value && (CITIES as readonly string[]).includes(value);
}

export function isBrowseWhen(value: string | undefined): value is BrowseWhen {
  return !!value && (BROWSE_WHEN as readonly string[]).includes(value);
}

export function isBrowsePrice(value: string | undefined): value is BrowsePrice {
  return value === 'free' || value === 'paid';
}

export function parseBrowseFilters(
  params: {
    city?: string | string[];
    when?: string | string[];
    price?: string | string[];
  } = {},
): BrowseFilters {
  const rawCity = firstParam(params.city);
  const rawWhen = firstParam(params.when);
  const rawPrice = firstParam(params.price);
  return {
    city: isCity(rawCity) ? rawCity : 'sydney',
    ...(isBrowseWhen(rawWhen) ? { when: rawWhen } : {}),
    ...(isBrowsePrice(rawPrice) ? { price: rawPrice } : {}),
  };
}

/** Single-select and deselectable: tapping the active chip clears it. */
export function toggleFilter<T extends string>(current: T | undefined, tapped: T): T | undefined {
  return current === tapped ? undefined : tapped;
}

export function browseQueryString(filters: BrowseFilters): string {
  const search = new URLSearchParams();
  search.set('city', filters.city);
  if (filters.when) search.set('when', filters.when);
  if (filters.price) search.set('price', filters.price);
  return search.toString();
}

export function browseHref(filters: BrowseFilters): string {
  const search = new URLSearchParams();
  if (filters.city !== 'sydney') search.set('city', filters.city);
  if (filters.when) search.set('when', filters.when);
  if (filters.price) search.set('price', filters.price);
  const qs = search.toString();
  return qs ? `/?${qs}` : '/';
}

export function browseHeading(when?: BrowseWhen): string {
  return BROWSE_HEADINGS[when ?? 'all'];
}

export function resultCountStatus(count: number): string {
  return `${count} ${count === 1 ? 'event' : 'events'}`;
}

/**
 * Formats the card's all-in price from the api's `priceFromAllInCents` (row 5.6: never computed in
 * the web app). Free events show "Free"; paid events show "From A$53.35 all-in".
 */
export function cardPriceLabel(priceFromAllInCents: number): string {
  return priceFromAllInCents === 0 ? 'Free' : `From ${formatAud(priceFromAllInCents)} all-in`;
}

export function cardVenueLabel(
  card: Pick<BrowseCardDto, 'online' | 'suburb' | 'venueName'>,
): string {
  if (card.online) return 'Online';
  if (card.suburb && card.venueName) return `${card.suburb} · ${card.venueName}`;
  return card.suburb ?? card.venueName ?? '';
}

/**
 * Reads all four card facts in one accessible label for the card link (row 5.5): title, date,
 * suburb · venue (or Online), and all-in price.
 */
export function cardAriaLabel(
  card: Pick<
    BrowseCardDto,
    'name' | 'startsAt' | 'timeZone' | 'online' | 'suburb' | 'venueName' | 'priceFromAllInCents'
  >,
): string {
  const date = eventEyebrow(card.startsAt, card.timeZone);
  const where = cardVenueLabel(card);
  const price = cardPriceLabel(card.priceFromAllInCents);
  return [card.name, date, where, price].filter(Boolean).join(', ');
}
