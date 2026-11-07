import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isAttendeeTicketsEnabled } from '@/lib/flags';
import { MyTicketsClient } from './MyTicketsClient';

export const metadata: Metadata = {
  title: 'My tickets · OneTickets',
  robots: { index: false, follow: false },
};

export default async function MyTicketsPage() {
  await connection();
  if (!isAttendeeTicketsEnabled()) notFound();

  return <MyTicketsClient />;
}
