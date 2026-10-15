import type { Metadata } from 'next';
import { can } from '@onetickets/shared';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import screen from '@/components/screen.module.css';
import { isEventWizardEnabled } from '@/lib/flags';
import { getSession } from '@/lib/session';
import { apiTemplate } from '@/lib/templates';
import { StartDraft } from './StartDraft';

export const metadata: Metadata = { title: 'New event' };

// Template rows on the organiser home land here. The draft is created from the browser, so a
// prefetch of this page can never create one.
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  // Flags are read at request time, never at build: without this, a build with the flag off
  // prerenders a permanent 404 that turning the flag on later can't undo.
  await connection();
  if (!isEventWizardEnabled()) notFound();
  const session = await getSession();
  if (!session) redirect('/signin');
  if (!session.organisation) redirect('/organiser/setup');
  if (!can(session.organisation.role, 'manageEvents')) notFound();
  const { template } = await searchParams;

  return (
    <div className={screen.screen}>
      <StartDraft organisationId={session.organisation.id} template={apiTemplate(template)} />
    </div>
  );
}
