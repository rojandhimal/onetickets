import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isAttendeeTicketsEnabled } from '@/lib/flags';
import { VerifyAttendeeClient } from './VerifyAttendeeClient';

export const metadata: Metadata = {
  title: 'Verifying link · OneTickets',
  robots: { index: false, follow: false },
};

export default async function VerifyAttendeePage() {
  await connection();
  if (!isAttendeeTicketsEnabled()) notFound();

  return <VerifyAttendeeClient />;
}
