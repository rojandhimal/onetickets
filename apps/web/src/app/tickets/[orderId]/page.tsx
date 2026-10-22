import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isTicketsEnabled } from '@/lib/flags';
import { TicketScreen } from './TicketScreen';

export const metadata: Metadata = {
  title: 'Your tickets',
  robots: { index: false, follow: false },
};

// S2-3, design artboard 4: the confirmation after booking and the ticket stubs. The order is read
// in the browser with the key from the URL fragment, which the server never sees.
export default async function TicketsPage({ params }: { params: Promise<{ orderId: string }> }) {
  // Flags are read at request time, so a build with the flag off can't prerender a lasting 404.
  await connection();
  if (!isTicketsEnabled()) notFound();
  const { orderId } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(orderId)) notFound();
  return <TicketScreen orderId={orderId} />;
}
