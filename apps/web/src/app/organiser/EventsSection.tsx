import type { EventDraftDto } from '@onetickets/shared';
import { type EventsView, eventCard } from '@/lib/organiser-events';
import styles from './organiser.module.css';

const VIEWS: { id: EventsView; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'drafts', label: 'Drafts' },
];

const EMPTY: Record<EventsView, { title: string; text: string }> = {
  upcoming: {
    title: 'Nothing coming up',
    text: 'Publish a draft or start a new event below.',
  },
  drafts: {
    title: 'No drafts',
    text: "Events you start but don't publish wait here, saved as you go.",
  },
};

/** Artboard 6 for S1: Upcoming and Drafts segments with one card per event. */
export function EventsSection({
  view,
  upcoming,
  drafts,
}: {
  view: EventsView;
  upcoming: EventDraftDto[];
  drafts: EventDraftDto[];
}) {
  const shown = (view === 'upcoming' ? upcoming : drafts).map(eventCard);
  const counts = { upcoming: upcoming.length, drafts: drafts.length };

  return (
    <section aria-labelledby="your-events" className={styles.events}>
      <h2 id="your-events" className="visually-hidden">
        Your events
      </h2>
      {/* Plain links, so each segment has its own URL and works without JavaScript. */}
      <nav aria-label="Events" className={styles.segments}>
        {VIEWS.map((v) => (
          <a
            key={v.id}
            href={`/organiser?view=${v.id}`}
            aria-current={v.id === view ? 'page' : undefined}
            className={styles.segment}
          >
            {v.label} <span className={styles.count}>{counts[v.id]}</span>
          </a>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className={styles.emptyView}>
          <strong>{EMPTY[view].title}</strong>
          <span>{EMPTY[view].text}</span>
        </div>
      ) : (
        <ul className={styles.eventList} aria-label={view === 'upcoming' ? 'Upcoming' : 'Drafts'}>
          {shown.map((card) => (
            <li key={card.id} className={styles.eventCard}>
              <div className={styles.eventTop}>
                <span className={styles.eventWhen}>{card.when}</span>
                <span
                  className={`${styles.chip} ${card.status === 'live' ? styles.chipLive : styles.chipDraft}`}
                >
                  {card.status === 'live' ? 'Live' : 'Draft'}
                </span>
              </div>
              <h3 className={styles.eventTitle}>{card.title}</h3>
              {card.sold && (
                <div className={styles.sold}>
                  <span>
                    {card.sold.sold} of {card.sold.capacity} booked
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span
                      style={{
                        width: `${card.sold.capacity ? (card.sold.sold / card.sold.capacity) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </div>
              )}
              <a href={card.action.href} className={styles.eventAction}>
                {card.action.label}
                <span className="visually-hidden">: {card.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
