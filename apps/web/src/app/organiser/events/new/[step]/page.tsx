import type { Metadata } from 'next';
import { can } from '@onetickets/shared';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getEventDraft } from '@/lib/events-server';
import { isEventWizardEnabled } from '@/lib/flags';
import { getSession } from '@/lib/session';
import { isWizardStep } from '@/lib/wizard-model';
import { Wizard } from '../Wizard';

export const metadata: Metadata = { title: 'New event' };

export default async function WizardStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  // Flags are read at request time, never at build: without this, a build with the flag off
  // prerenders a permanent 404 that turning the flag on later can't undo.
  await connection();
  if (!isEventWizardEnabled()) notFound();
  const [{ step }, { draft }] = await Promise.all([params, searchParams]);
  if (!isWizardStep(step) || !draft) notFound();

  const session = await getSession();
  if (!session) redirect('/signin');
  if (!session.organisation) redirect('/organiser/setup');
  if (!can(session.organisation.role, 'manageEvents')) notFound();

  const event = await getEventDraft(session.organisation.id, draft);
  if (!event || event.status !== 'draft') notFound();

  return <Wizard initialEvent={event} userId={session.user.id} userEmail={session.user.email} />;
}
