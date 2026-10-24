import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import {
  ACCESSIBILITY_LABELS,
  CANCELLATION_COPY,
  TEMPLATE_WORDS,
  accessibilitySummary,
  initials,
  mapsHref,
  priceLabel,
  priceNote,
  shareDescription,
  spotsLine,
} from '@/lib/event-page';
import { isBookingEnabled, isEventBannerShown } from '@/lib/flags';
import { getPublicEvent } from '@/lib/public-events';
import { eventEyebrow, eventEyebrowRange } from '@/lib/zoned-time';
import { ShareButton } from './ShareButton';
import styles from './event.module.css';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getPublicEvent((await params).slug);
  if (!event) return { title: 'Event not found' };
  const description = shareDescription(event, eventEyebrow(event.startsAt, event.timeZone));
  return {
    // Link previews need absolute URLs for the share image.
    metadataBase: new URL(process.env.WEB_URL ?? 'http://localhost:3000'),
    title: event.name,
    description,
    openGraph: { title: event.name, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: event.name, description },
  };
}

// S1-3, design artboard 2. Server-rendered: the only client code is the share button. Organiser
// text (name, About, access notes) is plain text from the api and is only ever rendered as text
// (SEC-3); this route also gets an enforced, nonce-based CSP from src/proxy.ts.
export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();

  const banner = isEventBannerShown() ? event.banner : null;
  const venue = event.venue;
  const access = accessibilitySummary(event.accessibility);
  const cancellation = CANCELLATION_COPY[event.cancellationPolicy];
  const price = priceLabel(event.priceFromAllInCents);
  const hasAccessSection = event.accessibility.features.length > 0 || !!access;

  return (
    <div className={styles.page}>
      <div className={`${styles.hero} ${banner ? '' : styles[event.template]}`}>
        {banner ? (
          // A plain img: the api already serves a sized 2:1 WebP, so next/image adds nothing.
          <img
            src={banner.url}
            alt=""
            width={banner.width}
            height={banner.height}
            className={styles.bannerImage}
            style={{ objectPosition: `${banner.focus.x * 100}% ${banner.focus.y * 100}%` }}
          />
        ) : (
          <span className={styles.heroWord} aria-hidden="true">
            {TEMPLATE_WORDS[event.template]}
          </span>
        )}
        <div className={styles.heroButtons}>
          <a href="/" className={styles.roundButton} aria-label="Back to events">
            <Icon name="back" size={22} />
          </a>
          <ShareButton
            title={event.name}
            className={styles.roundButton}
            statusClassName={styles.toast}
          />
        </div>
      </div>

      <div className={styles.layout}>
        <main className={styles.content}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>
              {eventEyebrowRange(event.startsAt, event.endsAt, event.timeZone)}
            </span>
            <h1>{event.name}</h1>
            {/* No organiser page in S1, so the name is plain text (ProductDesign). */}
            <span className={styles.byline}>by {event.organiser.name}</span>
          </div>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>
                <Icon name="ticket" size={22} />
                <span className="visually-hidden">Price</span>
              </dt>
              <dd>
                <strong>{price}</strong>
                <span>{priceNote(event)}</span>
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Icon name={venue.kind === 'online' ? 'online' : 'pin'} size={22} />
                <span className="visually-hidden">Venue</span>
              </dt>
              {venue.kind === 'online' ? (
                <dd>
                  <strong>Online event</strong>
                  <span>You get the link with your ticket.</span>
                </dd>
              ) : (
                <dd className={styles.venueFact}>
                  <span className={styles.factText}>
                    <strong>{venue.name}</strong>
                    <span>{venue.address}</span>
                  </span>
                  <a
                    href={mapsHref(venue)}
                    className={styles.mapThumb}
                    aria-label={`Open map of ${venue.name}`}
                  >
                    <MapArt />
                  </a>
                </dd>
              )}
            </div>
            <div className={styles.fact}>
              <dt>
                <Icon name="undo" size={22} />
                <span className="visually-hidden">Cancellations</span>
              </dt>
              <dd>
                <strong>{cancellation.title}</strong>
                <span>{cancellation.detail}</span>
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Icon name="access" size={22} />
                <span className="visually-hidden">Accessibility</span>
              </dt>
              {access ? (
                <dd>
                  <strong>{access.lead}</strong>
                  <span>
                    {access.rest.map((label) => `${label} · `).join('')}
                    <a href="#access" className={styles.inlineLink}>
                      Details
                    </a>
                  </span>
                </dd>
              ) : (
                <dd>
                  <strong>No accessibility details yet</strong>
                  <span>Booked? Reply to your confirmation email to ask the organiser.</span>
                </dd>
              )}
            </div>
          </dl>

          <section className={styles.organiser} aria-label="Organiser">
            <span className={styles.avatar} aria-hidden="true">
              {initials(event.organiser.name)}
            </span>
            <strong>{event.organiser.name}</strong>
          </section>

          {event.about.trim() && (
            <section className={styles.section} aria-labelledby="about-h">
              <h2 id="about-h">About</h2>
              <p className={styles.plainText}>{event.about}</p>
            </section>
          )}

          {hasAccessSection && (
            <section id="access" className={styles.card} aria-labelledby="access-h">
              <h2 id="access-h">Accessibility</h2>
              {event.accessibility.features.length > 0 && (
                <ul className={styles.chips}>
                  {event.accessibility.features.map((f) => (
                    <li key={f}>{ACCESSIBILITY_LABELS[f]}</li>
                  ))}
                </ul>
              )}
              {event.accessibility.notes.trim() && (
                <p className={styles.plainText}>{event.accessibility.notes}</p>
              )}
            </section>
          )}

          {venue.kind === 'place' && (
            <a
              href={mapsHref(venue)}
              className={styles.map}
              aria-label={`Open map of ${venue.name}`}
            >
              <MapArt large />
            </a>
          )}
        </main>

        <aside className={styles.bar} aria-label="Tickets">
          <div className={styles.barPrice}>
            <span className={styles.barAmount}>{price}</span>
            <span className={styles.barSpots}>{spotsLine(event)}</span>
          </div>
          {event.soldOut ? (
            // A label, not a disabled button: there's nothing to press (handoff-s2.md).
            <span className={styles.soon}>Sold out</span>
          ) : isBookingEnabled() ? (
            <a href={`/e/${encodeURIComponent(event.slug)}/tickets`} className={styles.getTickets}>
              Get tickets
            </a>
          ) : (
            <span className={styles.soon}>Tickets open soon</span>
          )}
        </aside>
      </div>
    </div>
  );
}

/** A drawn street corner and pin, standing in for a map tile until S1 picks a map provider. */
function MapArt({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox={large ? '0 0 640 140' : '0 0 60 52'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={styles.mapArt}
    >
      {large ? (
        <>
          <rect x="0" y="74" width="640" height="10" fill="#fff" />
          <rect x="315" y="0" width="10" height="140" fill="#fff" />
          <path d="M320 78c-9-10-14-17-14-24a14 14 0 0 1 28 0c0 7-5 14-14 24z" fill="#4338ca" />
        </>
      ) : (
        <>
          <rect x="0" y="22" width="60" height="6" fill="#fff" />
          <rect x="26" y="0" width="6" height="52" fill="#fff" />
          <path d="M29 27c-6-6-9-10-9-14a9 9 0 0 1 18 0c0 4-3 8-9 14z" fill="#4338ca" />
        </>
      )}
    </svg>
  );
}
