import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { can } from '@onetickets/shared';
import * as Sentry from '@sentry/nextjs';
import { Logo } from '@/components/Logo';
import { SentryContext } from '@/components/SentryContext';
import screen from '@/components/screen.module.css';
import { getSession } from '@/lib/session';
import { isEventWizardEnabled } from '@/lib/flags';
import { listEvents } from '@/lib/events-server';
import { welcomeLine } from '@/lib/greeting';
import { pickView, splitEvents } from '@/lib/organiser-events';
import { EVENT_TEMPLATES, newEventHref } from '@/lib/templates';
import { EventsSection } from './EventsSection';
import { SignOutButton } from './SignOutButton';
import styles from './organiser.module.css';

export const metadata: Metadata = { title: 'Organiser home' };

export default async function OrganiserHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
} = {}) {
  const session = await getSession();
  if (!session) redirect('/signin');
  const organisation = session.organisation;
  if (!organisation) redirect('/organiser/setup');
  const flagOn = isEventWizardEnabled();
  const canCreate = can(organisation.role, 'manageEvents');
  const wizardOn = flagOn && canCreate;
  // Finance and door staff can't create events. Once the wizard is on, a "Coming soon" list would
  // suggest it's on its way for them, so they get the reason instead.
  const notAllowed = flagOn && !canCreate;
  const events = wizardOn ? ((await listEvents(organisation.id)) ?? []) : [];
  const { upcoming, drafts } = splitEvents(events);
  const view = pickView((await searchParams)?.view, {
    upcoming: upcoming.length,
    drafts: drafts.length,
  });
  Sentry.setUser({ id: session.user.id });
  Sentry.setTag('organisation_id', organisation.id);

  return (
    <div className={screen.screen}>
      <SentryContext userId={session.user.id} organisationId={organisation.id} />
      <header className={screen.header}>
        <div className={screen.headerInner}>
          <div className={styles.topRow}>
            <Logo />
            <div className={styles.headerLinks}>
              <a href="/" className={styles.headerLink}>
                View site
              </a>
              <SignOutButton />
            </div>
          </div>
          <div className={styles.greeting}>
            <span className={styles.orgName}>{organisation.name}</span>
            <h1 className={`${screen.display} ${screen.pageTitle}`}>
              {welcomeLine(session.user.name)}
            </h1>
          </div>
        </div>
      </header>

      <main className={screen.main}>
        {events.length > 0 && <EventsSection view={view} upcoming={upcoming} drafts={drafts} />}

        <section className={styles.intro} aria-labelledby="no-events">
          <h2 id="no-events">{events.length > 0 ? 'Start a new event' : 'No events yet'}</h2>
          <p className={screen.text}>
            {wizardOn
              ? "Pick a template to start. We'll fill in sensible defaults and you can change anything."
              : notAllowed
                ? // The owner's name isn't visible to these roles yet, so the copy names the role.
                  'Only owners and admins can create events. Ask an owner to add you as an admin.'
                : "Creating events opens soon. You'll start from one of these templates."}
          </p>
        </section>

        {!notAllowed && (
          <ul aria-label="Event templates" className={styles.templates}>
            {EVENT_TEMPLATES.map((t) => {
              const content = (
                <>
                  <span className={`${styles.templateIcon} ${styles[t.id]}`}>
                    <Icon name={t.icon} size={24} />
                  </span>
                  <span className={styles.templateText}>
                    <strong>{t.name}</strong>
                    <span>{t.description}</span>
                  </span>
                </>
              );
              return (
                <li key={t.id}>
                  {wizardOn ? (
                    <a href={newEventHref(t.id)} className={styles.template}>
                      {content}
                      <span className={styles.chevron}>
                        <Icon name="chevron" />
                      </span>
                    </a>
                  ) : (
                    <div className={`${styles.template} ${styles.templateSoon}`}>
                      {content}
                      <span className={styles.soonChip}>
                        <span aria-hidden="true">Coming soon</span>
                        <span className="visually-hidden">{`${t.name}, coming soon`}</span>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {wizardOn && (
          <a href={newEventHref()} className={styles.blank}>
            Start from a blank event
          </a>
        )}

        <section className={`${screen.notice} ${screen.noticeWarm}`} aria-label="Paid tickets">
          <Icon name="info" />
          <p>
            Selling paid tickets? You&apos;ll add your ABN and bank details when you create your
            first paid ticket. Free events never need them.
          </p>
        </section>
      </main>
    </div>
  );
}
