'use client';

import { CITIES, type BrowseCardDto, type BrowseResponse, type City } from '@onetickets/shared';
import { useRef, useState } from 'react';
import {
  BROWSE_EMPTY,
  BROWSE_NOTE,
  type BrowseFilters,
  type BrowsePrice,
  type BrowseWhen,
  CITY_LABELS,
  PRICE_OPTIONS,
  WHEN_OPTIONS,
  browseHeading,
  browseHref,
  browseQueryString,
  cardAriaLabel,
  cardPriceLabel,
  cardVenueLabel,
  resultCountStatus,
  toggleFilter,
} from '@/lib/browse';
import { TEMPLATE_WORDS } from '@/lib/event-page';
import { eventEyebrow } from '@/lib/zoned-time';
import styles from './browse.module.css';

// S1-5, design artboard 1 Discover. Cards link to /e/:slug with plain <a> tags (ADR 0018) so
// opening an event loads the enforced per-request nonce CSP. Organiser text is rendered as text
// only (SEC-3).
export function Browse({
  initialFilters,
  initialItems,
  showBanner,
}: {
  initialFilters: BrowseFilters;
  initialItems: BrowseCardDto[];
  showBanner: boolean;
}) {
  const [filters, setFilters] = useState<BrowseFilters>(initialFilters);
  const [items, setItems] = useState<BrowseCardDto[]>(initialItems);
  const [cityOpen, setCityOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function applyFilters(next: BrowseFilters) {
    setFilters(next);
    if (typeof window !== 'undefined' && typeof window.history?.replaceState === 'function') {
      window.history.replaceState(null, '', browseHref(next));
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/public/events?${browseQueryString(next)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as BrowseResponse;
      if (!controller.signal.aborted) {
        setItems(data.items);
      }
    } catch {
      // Aborted or offline: keep the current list on screen.
    }
  }

  function selectCity(city: City) {
    setCityOpen(false);
    if (city === filters.city) return;
    void applyFilters({ ...filters, city });
  }

  function selectWhen(tapped: BrowseWhen) {
    const nextWhen = toggleFilter(filters.when, tapped);
    const next: BrowseFilters = { city: filters.city };
    if (nextWhen) next.when = nextWhen;
    if (filters.price) next.price = filters.price;
    void applyFilters(next);
  }

  function selectPrice(tapped: BrowsePrice) {
    const nextPrice = toggleFilter(filters.price, tapped);
    const next: BrowseFilters = { city: filters.city };
    if (filters.when) next.when = filters.when;
    if (nextPrice) next.price = nextPrice;
    void applyFilters(next);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.topRow}>
            <span className="brand">
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect x="1" y="5" width="26" height="18" rx="5" fill="var(--marigold)" />
                <circle cx="1" cy="14" r="3.5" fill="var(--ink)" />
                <circle cx="27" cy="14" r="3.5" fill="var(--ink)" />
                <path d="M14 9v10" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span className="brand-name">OneTickets</span>
            </span>

            <button
              type="button"
              className={styles.cityTrigger}
              aria-expanded={cityOpen}
              aria-controls="city-picker"
              onClick={() => setCityOpen((open) => !open)}
            >
              Near {CITY_LABELS[filters.city]} · <span className={styles.cityChange}>Change</span>
            </button>
          </div>

          {cityOpen && (
            <div id="city-picker" role="group" aria-label="City" className={styles.cityPicker}>
              {CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.cityOption}
                  aria-pressed={filters.city === c}
                  onClick={() => selectCity(c)}
                >
                  {CITY_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.filters}>
          <div role="group" aria-labelledby="filter-when-label" className={styles.filterGroup}>
            <span id="filter-when-label" className="visually-hidden">
              When
            </span>
            {WHEN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={styles.chip}
                aria-pressed={filters.when === opt.id}
                onClick={() => selectWhen(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div role="group" aria-labelledby="filter-price-label" className={styles.filterGroup}>
            <span id="filter-price-label" className="visually-hidden">
              Price
            </span>
            {PRICE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={styles.chip}
                aria-pressed={filters.price === opt.id}
                onClick={() => selectPrice(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.headingBlock}>
          <h1 className={styles.heading}>{browseHeading(filters.when)}</h1>
          <p className={styles.note}>{BROWSE_NOTE}</p>
          <p role="status" className="visually-hidden">
            {resultCountStatus(items.length)}
          </p>
        </div>

        {items.length === 0 ? (
          <p className={styles.empty}>{BROWSE_EMPTY}</p>
        ) : (
          <ul className={styles.cardList} aria-label="Upcoming events">
            {items.map((card) => {
              const banner = showBanner ? card.banner : null;
              const date = eventEyebrow(card.startsAt, card.timeZone);
              const where = cardVenueLabel(card);
              const price = cardPriceLabel(card.priceFromAllInCents);
              const isFree = card.priceFromAllInCents === 0;
              return (
                <li key={card.slug} className={styles.cardItem}>
                  <a
                    href={`/e/${encodeURIComponent(card.slug)}`}
                    className={styles.card}
                    aria-label={cardAriaLabel(card)}
                  >
                    <div className={`${styles.cardMedia} ${banner ? '' : styles[card.template]}`}>
                      {banner ? (
                        <img
                          src={banner.url}
                          alt=""
                          width={banner.width}
                          height={banner.height}
                          className={styles.cardBanner}
                          style={{
                            objectPosition: `${banner.focus.x * 100}% ${banner.focus.y * 100}%`,
                          }}
                        />
                      ) : (
                        <span className={styles.cardWord} aria-hidden="true">
                          {TEMPLATE_WORDS[card.template]}
                        </span>
                      )}
                      {isFree && <span className={styles.freeBadge}>Free</span>}
                    </div>
                    <div className={styles.cardBody}>
                      <span className={styles.cardEyebrow}>{date}</span>
                      <h2 className={styles.cardTitle}>{card.name}</h2>
                      <span className={styles.cardVenue}>{where}</span>
                      <span className={styles.cardPrice}>{price}</span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
