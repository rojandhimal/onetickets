import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import screen from '@/components/screen.module.css';
import { getSession } from '@/lib/session';
import { isEventWizardEnabled } from '@/lib/flags';
import { welcomeLine } from '@/lib/greeting';
import { EVENT_TEMPLATES, newEventHref } from '@/lib/templates';
import styles from './organiser.module.css';

export const metadata: Metadata = { title: 'Organiser home' };

export default async function OrganiserHomePage() {
  const session = await getSession();
  if (!session) redirect('/signin');
  const organisation = session.organisation;
  if (!organisation) redirect('/organiser/setup');
  const wizardOn = isEventWizardEnabled();

  // S0-3 only ships the empty state. The events list arrives with S1-1.
  return (
    <div className={screen.screen}>
      <header className={screen.header}>
        <div className={screen.headerInner}>
          <div className={styles.topRow}>
            <Logo />
            <a href="/" className={styles.viewSite}>
              View site
            </a>
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
        <section className={styles.intro} aria-labelledby="no-events">
          <h2 id="no-events">No events yet</h2>
          <p className={screen.text}>
            {wizardOn
              ? "Pick a template to start. We'll fill in sensible defaults and you can change anything."
              : "Creating events opens soon. You'll start from one of these templates."}
          </p>
        </section>

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
                    <span className={styles.soonChip}>Coming soon</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

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
