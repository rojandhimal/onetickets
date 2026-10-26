import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isBookingEnabled } from '@/lib/flags';
import { getPublicEvent } from '@/lib/public-events';
import { Checkout } from './Checkout';

// Force dynamic rendering so Next.js App Router injects per-request nonces into bootstrap scripts (ADR 0018 / SEC-14).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return { title: 'Event not found' };
  return {
    title: `Get your tickets · ${event.name}`,
    description: `Get free tickets to ${event.name}. No account or password needed.`,
  };
}

export default async function CheckoutPage({ params }: Props) {
  await connection();
  if (!isBookingEnabled()) notFound();

  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();

  return <Checkout event={event} />;
}
