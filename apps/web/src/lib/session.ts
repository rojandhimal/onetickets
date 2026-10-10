import 'server-only';
import { cookies } from 'next/headers';
import type { Session } from '@onetickets/shared';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

/** The signed-in organiser, or null when signed out. Server components only. */
export async function getSession(): Promise<Session | null> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${apiUrl}/me`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /me failed with ${res.status}`);
  return (await res.json()) as Session;
}
